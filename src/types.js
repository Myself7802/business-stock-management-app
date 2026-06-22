/**
 * @typedef {Object} Product
 * @property {string} id
 * @property {string} name
 * @property {string} [category]
 * @property {string} [sku]
 * @property {number} costPrice
 * @property {number} salePrice
 * @property {number} qty
 * @property {number} [threshold]
 */

/**
 * @typedef {Object} Party
 * @property {string} id
 * @property {string} name
 * @property {'customer'|'supplier'} type
 * @property {string} [phone]
 * @property {string} [address]
 * @property {number} [openingBalance]
 */

/**
 * @typedef {Object} BillLine
 * @property {string} productId
 * @property {string} name
 * @property {number} costPrice
 * @property {number} salePrice
 * @property {number} qty
 */

/**
 * @typedef {Object} Bill
 * @property {string} id
 * @property {number} no
 * @property {string} date
 * @property {string} partyId
 * @property {BillLine[]} items
 * @property {number} total
 * @property {number} [paid]
 * @property {string} [note]
 * @property {number} [createdAt]
 */

/**
 * @typedef {Object} Expense
 * @property {string} id
 * @property {string} date
 * @property {string} [category]
 * @property {number} amount
 * @property {string} [note]
 */

/**
 * @typedef {Object} Payment
 * @property {string} id
 * @property {string} date
 * @property {string} partyId
 * @property {'in'|'out'} type
 * @property {number} amount
 * @property {string} [mode]
 * @property {string} [note]
 */

/**
 * @typedef {Object} TrashItem
 * @property {string} id
 * @property {string} kind
 * @property {Object} data
 * @property {number} deletedAt
 */

/**
 * @typedef {Object} Meta
 * @property {number|null} lastBackupAt
 * @property {number|null} lastChangeAt
 * @property {number} saleNo
 * @property {number} purchaseNo
 */

export {};
