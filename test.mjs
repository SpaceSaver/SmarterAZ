import { SmarterAZ } from "./SmarterAZ.mjs";

const my_smarteraz = new SmarterAZ();
console.log(await my_smarteraz.makeSearch("thinkpad", {high_price: 250, low_price: 0}));