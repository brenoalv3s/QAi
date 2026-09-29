/**
 * Hub da suíte Playwright (equivalente ao main.resource do Robot).
 * Specs importam só este arquivo — nunca locators, data ou `new Page`.
 */
export { test, expect } from './page-fixtures'
export { dado, quando, entao, e } from '../tests/helpers/bdd'
export { titulo } from '../tests/helpers/cenario'
