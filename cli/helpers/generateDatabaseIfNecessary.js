const fs = require('fs-extra');

function generateReceiptDatabaseIfNecessary(RECEIPTS_DATABASE_PATH) {
  if (!fs.pathExistsSync(RECEIPTS_DATABASE_PATH)) {
    console.log(`> Creating receipts database at ${RECEIPTS_DATABASE_PATH}`);
    fs.writeJsonSync(RECEIPTS_DATABASE_PATH, []);
  }
}

module.exports = generateReceiptDatabaseIfNecessary;
