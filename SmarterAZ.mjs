import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import * as cheerio from "cheerio";
import puppeteer from "puppeteer";

function pass(ingoing) {
    console.log(ingoing);
    return ingoing;
}

export class SmarterAZ{
    /**
     * Creates a new SmarterAZ object for using SmarterAZ.
     * @param {string} [AmazonURL] - Your country-specific AmazonURL, defaults to `www.amazon.com`
     * @param {Object} [options] - Options for more pedantic pieces of the app.
     * @param {string} [options.useragent] - The user agent that is used for requests to Amazon.  Defaults to one ripped from Chrome.
     * @param {import("axios").CreateAxiosDefaults} [options.axios] - Additional options for configuring axios.  (Where you'd add proxy config)
     * @param {boolean} [options.useAxios] - Switches from the default puppeteer to using regular Axios requests which Amazon may block.
     * 
     */
    constructor(AmazonURL, options) {
        this.__azurl = AmazonURL || "www.amazon.com";
        this.__baseurl = "https://" + this.__azurl + "/"
        this.__useaxios = !!options?.useAxios;
        this.__useragent = options?.useragent || "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36";
        if (this.__useaxios) {
            this.__jar = new CookieJar();
            const axios_options = { ...options?.axios };
            if (!axios_options.headers) {
                axios_options.headers = {};
            }
            if (!axios_options.headers["User-Agent"]) {
                axios_options.headers["User-Agent"] = options?.useragent || "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36";
            }
            this.__client = wrapper(axios.create(axios_options));
        }

    }

    /**
     * @typedef {Object} AZSearchResults
     * @property {Array<AZResultItem>} items - Items returned by the search.
     * @property {number} current_page - Page in search results.
     * @property {number} max_page - Last page in results.
     */

    /**
     * @typedef {Object} AZResultItem
     * @property {string} name - Item name.
     * @property {string} price - Item price (with regional formatting from Amazon).
     * @property {string|null} altprice - Item price from alternate sellers (with regional formatting from Amazon).
     * @property {string} image - URL to item image.
     * @property {string|null} coupon - Item coupon if available.
     * @property {string} link - Link to the product
     * 
     */

    /**
     * Parses an Amazon search results page.
     * @param {import("cheerio").CheerioAPI}
     * @returns {AZSearchResults}
     */
    parsePage(page) {
        const items = page("[data-component-type=\"s-search-result\"].s-result-item:not(.AdHolder)").toArray().map((el) => {
            // console.log(i);
            return {
                image: page(".s-image", el).attr().src,
                name: page(".a-size-medium.a-color-base.a-text-normal", el).text(),
                price: page(".a-offscreen", page(".a-price:not([data-a-strike])", el)).first().text(),
                altprice: page("[data-action=\"s-show-all-offers-display\"] ~ span.a-color-base", page(".a-section.a-spacing-none.a-spacing-top-mini", el)).first().text() || null,
                coupon: page(".s-coupon-highlight-color", page(".s-coupon-unclipped", el)).text() || null,
                link: `${this.__baseurl}dp/${page(el).attr()["data-asin"]}`
            };
        });
        const nav = page(".s-pagination-strip");
        const max_page = parseInt(pass(page(".s-pagination-item:not(.s-pagination-next)", nav).last().text()));
        const current_page = parseInt(page(".s-pagination-selected", nav).first().text());
        return {items, current_page, max_page};
    }

    /**
     * Makes a search on Amazon and returns a complete list of items from all of the pages.
     * @param {string} term - Search term given to Amazon
     * @param {Object} param1 - Additional search parameters.
     * @param {number} [param1.high_price] - Upper price limit
     * @param {number} [param1.low_price] - Lower price limit
     * @param {string} [param1.seller] - ID of seller (ATVPDKIKX0DER for Amazon US)
     * @param {string} [param1.shipper] - ID of shipper (only appears to work with Amazon (1249137011) and is overriden by seller)
     */
    async makeSearch(term, {high_price, low_price, seller, shipper}) {
        const first_page = await this.makePageSearch(term, 1, {high_price, low_price, seller, shipper});
        const items = [];
        items.push.apply(items, first_page.items);
        let last_page = first_page.max_page;
        for (let x = 2; x <= last_page; x++) {
            const data = (await this.makePageSearch(term, x, {high_price, low_price, seller, shipper}))
            items.push.apply(items, data.items);
            if (data.max_page > last_page) last_page = data.max_page;
        }
        return items;
    }

    /**
     * Makes a search on Amazon and returns a list of results from a specific page.
     * @param {string} term - Search term given to Amazon
     * @param {Object} param1 - Additional search parameters.
     * @param {number} [param1.high_price] - Upper price limit
     * @param {number} [param1.low_price] - Lower price limit
     * @param {string} [param1.seller] - ID of seller (ATVPDKIKX0DER for Amazon US) -- Good stuff: https://www.reddit.com/comments/13nyl2k/comment/jmmqllg/
     * @param {string} [param1.shipper] - ID of shipper (only appears to work with Amazon (1249137011) and is overriden by seller)
     * @param {number} page - The page of the results to grab.
     * @returns {AZSearchResults} - Results from the search
     */
    async makePageSearch(term, page, {high_price, low_price, seller, shipper}) {
        const params = new URLSearchParams();
        params.set("k", term);
        if (high_price) params.set("high-price", high_price);
        if (low_price) params.set("low-price", low_price);
        if (seller) {
            params.set("rh", "p_6:" + seller);
        } else if (shipper) {
            params.set("rh", "p_76:" + shipper);
        }
        params.set("page", page);
        const search_url = new URL("/s?" + params.toString(), this.__baseurl);
        return this.parsePage(cheerio.load(pass(await this.__makeRequest(search_url))));
    }

    /**
     * Makes a request either with Puppeteer or Axios.
     * @param {string} url 
     * @returns {string} - Page content
     */
    async __makeRequest(url) {
        if (this.__useaxios) {
            return (await this.__client.get(url)).data;
        } else {
            if (!this.__browser) {
                this.__browser = await puppeteer.launch({headless: false, });
            }
            const page = await this.__browser.newPage();
            page.setUserAgent(this.__useragent);
            // await page.goto(this.__baseurl);
            await page.goto(url);
            let source = await page.content({"waitUntil": "domcontentloaded"});
            while (source.includes("https://images-na.ssl-images-amazon.com/images/G/01/error/")) {
                // return "error";
                // source = await (new Promise(resolve => {
                //     setTimeout(async () => {
                //         resolve(await this.__makeRequest(url));
                //     }, 5000);
                // }));
                await page.reload();
                source = await page.content({"waitUntil": "domcontentloaded"});
            }
            page.close();
            return source;
        }
    }
}