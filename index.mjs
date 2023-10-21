import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import * as cheerio from "cheerio";

const jar = new CookieJar();
const client = wrapper(axios.create({ jar, headers: {"User-Agent": "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"} }));

const res = await client.get("https://www.amazon.com/s?k=thinkpad&high-price=250");
const page = cheerio.load(res.data);
// page(".a-size-medium.a-color-base.a-text-normal", undefined, undefined, ).each((i, txtef) => console.log(page(txtef).text()));

const chips = page("[data-component-type=\"s-search-result\"].s-result-item:not(.AdHolder)").toArray().map((el) => {
    // console.log(i);
    return {
        image: page(".s-image", el).attr().src,
        name: page(".a-size-medium.a-color-base.a-text-normal", el).text(),
        price: page(".a-offscreen", page(".a-price:not([data-a-strike])", el)).text(),
        altprice: page(".a-color-base", page(".a-section.a-spacing-none.a-spacing-top-mini", el)).text() || null,
        coupon: page(".s-coupon-highlight-color", page(".s-coupon-unclipped", el)).text() || null
    };
});
console.log(chips);