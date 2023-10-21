import { SmarterAZ } from "./SmarterAZ.mjs";

const my_smarteraz = new SmarterAZ();
const my_info = await my_smarteraz.makeSearch("thinkpad", {high_price: 250, low_price: 0});
console.log(my_info);