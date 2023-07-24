const puppeteer = require('puppeteer');
const xml2js = require('xml2js');
const fs = require('fs');

// URLs to look for
const url1 = '/application/527EZ';
const url2 = '/burials-and-memorials/application/530';

// Reading XML from file
const xml = fs.readFileSync('./sitemap.xml');
const startTime = Date.now();

// Create log directory
try {
    fs.mkdirSync(`sitemap/${startTime}`, { recursive: true });
    console.log('Directory created successfully!');
} catch (err) {
    console.error(err);
}

// Converting XML to JSON
xml2js.parseString(xml, async function(err, result) {
  if (err) {
    console.error('Error while parsing XML:', err);
    return;
  }

  const urls = result.urlset.url.map(u => u.loc[0].trim());

  const browser = await puppeteer.launch({ headless: 'new', product: 'firefox' });

  for (let url of urls) {
    const page = await browser.newPage();
    try {
        pupc_log('logs.txt',`Crawling: ${url}`);
        await page.goto(url, { timeout: 10000 });
    
        // Search for the specific links in the page
        const links = await page.evaluate((url1, url2) => Array.from(document.querySelectorAll('a'))
          .map(a => a.href)
          .filter(href => href.includes(url1) || href.includes(url2)), url1, url2);
        pupc_log('logs.txt',`Found ${links.length} relevant links in ${url}`)
        pupc_log('found_links.txt',`${url} , ${links}`)
        for (let link of links){
            pupc_log('links.txt',`${link}`)
        }
    } catch(err){
        pupc_log('errors.txt',`${url} , ${err}`)
    }
    await page.close()    
  }

  await browser.close();
});

function pupc_log(file,message){
    fs.appendFileSync(`sitemap/${startTime}/${file}`, `${message}\n`);
    console.log(message)

}