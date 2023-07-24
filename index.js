const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());
//require('events').EventEmitter.defaultMaxListeners = 10000; // Or another suitable number
const visitedUrls = new Set();
const foundUrls = [];
const failedUrls = [];
const totalLinks = [];
let linksVisited = 0;
const BASE_URL = 'https://staging.va.gov/';
const PROD_URL = 'https://www.va.gov';
const startTime = Date.now();
let browser = null;
async function crawlPage(url) {
    if (!browser) {
        browser = await puppeteer.launch({ headless: 'new', product: 'firefox' });
    }
    const page = await browser.newPage();
    if (visitedUrls.has(url)) {
        visitedUrls.add(url);
        page.close()
        return;
    }

    if (url.match(/\.(png|jpg|jpeg)$/)) {
        visitedUrls.add(url);
        console.log(`Skipping non-HTML page ${url}`);
        fs.appendFileSync(`${startTime}/logs.txt`, `\nSkipping non-HTML page ${url}`);
        page.close()
        return;
    }

    if (url.includes('#content')) {
        visitedUrls.add(url);
        console.log(`Skipping url with #content ${url}`);
        fs.appendFileSync(`${startTime}/logs.txt`, `\nSkipping url with #content ${url}`);
        page.close()
        return;
    }
    //skipping all urls with query strings
    if (url.includes('?')) {
        visitedUrls.add(url);
        console.log(`Skipping url with query string ${url}`);
        fs.appendFileSync(`${startTime}/logs.txt`, `\nSkipping url with ?next query string ${url}`);
        page.close()
        return;
    }

    console.log(`There are currently ${totalLinks.length - linksVisited} links left to visit`)
    fs.appendFileSync(`${startTime}/logs.txt`, `\nThere are currently ${totalLinks.length - linksVisited} links left to visit`)
    console.log(`Crawling page ${url}`);
    fs.appendFileSync(`${startTime}/logs.txt`, `\nCrawling page ${url}`);
    visitedUrls.add(url);
    fs.appendFileSync(`${startTime}/visited_urls.txt`, `\n${url}`);
    let links = [];
    try {
        await page.goto(url, { timeout: 15000 });
        const pageText = await page.evaluate(() => document.body.innerText);
        if (pageText.includes("VA.gov isn't working right now")) {
            fs.appendFileSync(`${startTime}/needs_manual_review.txt`, `${url}\n`);
            return;
        }
        links = await page.evaluate(() => Array.from(document.querySelectorAll('a'), a => a.href));

        const linkToFind = ['/application/527EZ', '/burials-and-memorials/application/530'];
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
    } catch (error) {
        console.log(`Failed to crawl "${url}": ${error.message}`);
        fs.appendFileSync(`${startTime}/logs.txt`, `Failed to crawl "${url}": ${error.message}`);
        failedUrls.push(url);
        fs.appendFileSync(`${startTime}/failed_urls.txt`, `\n${url}`);
    } finally {
        await page.close();
    }

    for (let link of links) {
        if (!totalLinks.includes(link)) {
            totalLinks.push(link)
        }
    }
    // Spawn a new browser for each unvisited link.
    for (let link of links) {
        if (link.startsWith(PROD_URL)) {
            console.log(`PROD url found ${link}`);
            fs.appendFileSync(`${startTime}/prod_urls_found.txt`, `\n${url},${link}`);
        } else if (link.startsWith(BASE_URL) && !visitedUrls.has(link)) {
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
    browser.close()
}

runCrawler();
