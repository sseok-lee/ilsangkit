import { defineEventHandler, sendRedirect, getRequestURL } from 'h3'

const SUBSCRIPTION_RENT_PATTERN = /^\/subscription\/rent\/(buy-lease|charter)\/?$/
const LH_RENTAL_TYPE_PATTERN = /^\/lh-rental\/(buy-lease|charter)\/?$/
const LH_RENTAL_HUB_PATTERN = /^\/lh-rental\/?$/

export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname

  const subscriptionMatch = path.match(SUBSCRIPTION_RENT_PATTERN)
  if (subscriptionMatch) {
    return sendRedirect(event, `/public-rental/${subscriptionMatch[1]}`, 301)
  }

  const lhTypeMatch = path.match(LH_RENTAL_TYPE_PATTERN)
  if (lhTypeMatch) {
    return sendRedirect(event, `/public-rental/${lhTypeMatch[1]}`, 301)
  }

  if (LH_RENTAL_HUB_PATTERN.test(path)) {
    return sendRedirect(event, '/public-rental', 301)
  }
})
