const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const pdf = require('pdf-parse');
puppeteer.use(StealthPlugin());

const visitedUrls = new Set();
const foundUrls = [];
const failedUrls = [];
const totalLinks = [];
let linksVisited = 0;
const BASE_URL = 'https://www.va.gov/';
const startTime = Date.now();

async function crawlPage(url) {
    const browser = await puppeteer.launch({headless:'new'});
    const page = await browser.newPage();
    if (visitedUrls.has(url)) {
        return;
    }

    if (url.match(/\.(png|jpg|jpeg)$/)) {
        console.log(`Skipping non-HTML page ${url}`);
        fs.appendFileSync(`${startTime}/logs.txt`, `Skipping non-HTML page ${url}`);
        return;
    }

    if (url.includes('#content')) {
        console.log(`Skipping url with #content ${url}`);
        fs.appendFileSync(`${startTime}/logs.txt`, `Skipping url with #content ${url}`);
        return;
    }

    if (url.includes('?next')) {
        console.log(`Skipping url with ?next query string ${url}`);
        fs.appendFileSync(`${startTime}/logs.txt`, `Skipping url with ?next query string ${url}`);
        return;
    }
    console.log(`There are currently ${totalLinks.length - linksVisited} links left to visit`)
    fs.appendFileSync(`${startTime}/logs.txt`, `There are currently ${totalLinks.length - linksVisited} links left to visit`)
    console.log(`Crawling page ${url}`);
    fs.appendFileSync(`${startTime}/logs.txt`, `Crawling page ${url}`);
    visitedUrls.add(url);
    fs.appendFileSync(`${startTime}/visited_urls.txt`, `\n${url}`);
    let links = [];
    try {
        await page.goto(url, { timeout: 10000 });
        await page.waitForTimeout(7000);

        const pageText = await page.evaluate(() => document.body.innerText);
        if (pageText.includes("VA.gov isn't working right now")) {
            fs.appendFileSync(`${startTime}/needs_manual_review.txt`, `${url}\n`);
        }

        if (url.endsWith('.pdf')) {
            const response = await page.goto(url, { timeout: 10000 });
            const buffer = await response.buffer();
            const data = await pdf(buffer);

            links = data.text.match(/\bhttps?:\/\/\S+/gi);
            for (let pdfUrl of links) {
                const linkToFind = ['/application/527EZ/introduction', '/burials-and-memorials/application/530/introduction'];
                for (let targetLink of linkToFind) {
                    if (pdfUrl.includes(targetLink) && !foundUrls.includes(pdfUrl)) {
                        console.log(`Found target link in PDF ${pdfUrl}`);
                        fs.appendFileSync(`${startTime}/logs.txt`, `Found target link in PDF ${pdfUrl}`);
                        foundUrls.push(pdfUrl);
                        fs.appendFileSync(`${startTime}/found_urls.txt`, `\n${pdfUrl} || ${targetLink}`);
                    }
                }
            }
        } else {
            links = await page.evaluate(() => Array.from(document.querySelectorAll('a'), a => a.href));

            const linkToFind = ['/application/527EZ/introduction', '/burials-and-memorials/application/530/introduction'];
            for (let link of links) {
                for (let targetLink of linkToFind) {
                    if (link.includes(targetLink) && !foundUrls.includes(link)) {
                        console.log(`Found target link on page ${link}`);
                        fs.appendFileSync(`${startTime}/logs.txt`, `Found target link on page ${link}`);
                        foundUrls.push(link);
                        fs.appendFileSync(`${startTime}/found_urls.txt`, `\n${link} || ${targetLink}`);
                    }
                }
            }
        }
    } catch (error) {
        console.log(`Failed to crawl "${url}": ${error.message}`);
        fs.appendFileSync(`${startTime}/logs.txt`, `Failed to crawl "${url}": ${error.message}`);
        failedUrls.push(url);
        fs.appendFileSync(`${startTime}/failed_urls.txt`, `\n${url}`);
    } finally {
        await browser.close();
    }

    for (let link of links) {
        if (!totalLinks.includes(link)) {
            totalLinks.push(link)
        }
    }
    // Spawn a new browser for each unvisited link.
    for (let link of links) {
        if (link.startsWith(BASE_URL) && !visitedUrls.has(link)) {
            await crawlPage(link);
        }
    }
}

async function runCrawler() {
    try {
        fs.mkdirSync(`${startTime}`, { recursive: true });
        console.log('Directory created successfully!');
    } catch (err) {
        console.error(err);
    }
    await crawlPage(BASE_URL);
}

runCrawler();
