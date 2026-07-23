const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

const exportMap = {
  // Types
  'Customer': '@/lib/firebase/types',
  'InventoryItem': '@/lib/firebase/types',
  'Transaction': '@/lib/firebase/types',
  'JobCard': '@/lib/firebase/types',
  'JobCardPart': '@/lib/firebase/types',
  'Expense': '@/lib/firebase/types',
  'Vendor': '@/lib/firebase/types',
  'BusinessProfile': '@/lib/firebase/types',
  'DocumentType': '@/lib/firebase/types',
  'PaymentStatus': '@/lib/firebase/types',
  'JobCardStatus': '@/lib/firebase/types',
  'ItemType': '@/lib/firebase/types',
  'ExpenseCategory': '@/lib/firebase/types',
  'FormatMode': '@/lib/firebase/types',
  'AdjustmentReason': '@/lib/firebase/types',
  
  // Config
  'app': '@/lib/firebase/config',
  'db': '@/lib/firebase/config',
  'auth': '@/lib/firebase/config',
  'storage': '@/lib/firebase/config',

  // Utils
  'numberToWords': '@/lib/firebase/utils/numberToWords',

  // API Customers
  'searchCustomers': '@/lib/firebase/api/customers',
  'getCustomer': '@/lib/firebase/api/customers',
  'createCustomer': '@/lib/firebase/api/customers',
  'updateCustomer': '@/lib/firebase/api/customers',
  'deleteCustomer': '@/lib/firebase/api/customers',
  'updateCustomerUdhaarBalance': '@/lib/firebase/api/customers',

  // API Inventory
  'searchInventory': '@/lib/firebase/api/inventory',
  'addInventoryItem': '@/lib/firebase/api/inventory',
  'updateInventoryItem': '@/lib/firebase/api/inventory',
  'softDeleteInventoryItem': '@/lib/firebase/api/inventory',
  'adjustStock': '@/lib/firebase/api/inventory',

  // API Transactions
  'searchTransactions': '@/lib/firebase/api/transactions',
  'finalizeTransaction': '@/lib/firebase/api/transactions',
  'voidTransaction': '@/lib/firebase/api/transactions',
  'getTransactionsByCustomer': '@/lib/firebase/api/transactions',
  'getLatestDocumentNo': '@/lib/firebase/api/transactions',

  // API JobCards
  'createJobCard': '@/lib/firebase/api/jobCards',
  'getJobCards': '@/lib/firebase/api/jobCards',
  'getJobCard': '@/lib/firebase/api/jobCards',
  'updateJobCardStatus': '@/lib/firebase/api/jobCards',
  'addPartToJobCard': '@/lib/firebase/api/jobCards',
  'deleteJobCard': '@/lib/firebase/api/jobCards',
  'getJobCardsByCustomer': '@/lib/firebase/api/jobCards',

  // API Settings
  'updateBusinessProfile': '@/lib/firebase/api/settings',
  'wipeStoreData': '@/lib/firebase/api/settings',

  // API Auth
  'signOut': '@/lib/firebase/api/auth'
};

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Find import { ... } from '@/lib/firebase';
  const importRegex = /import\s+{([^}]+)}\s+from\s+['"]@\/lib\/firebase['"];?/g;
  
  let modified = false;
  content = content.replace(importRegex, (match, importsStr) => {
    modified = true;
    const imports = importsStr.split(',').map(s => s.trim()).filter(s => s);
    
    const groups = {};
    for (const imp of imports) {
      let cleanImp = imp.replace(/^type\s+/, '');
      const aliasMatch = cleanImp.match(/(\w+)\s+as\s+\w+/);
      if (aliasMatch) cleanImp = aliasMatch[1];
      
      const source = exportMap[cleanImp] || '@/lib/firebase/index'; 
      if (!groups[source]) groups[source] = [];
      groups[source].push(imp);
    }
    
    let replacement = '';
    for (const [source, imps] of Object.entries(groups)) {
      replacement += `import { ${imps.join(', ')} } from '${source}';\n`;
    }
    return replacement.trim();
  });

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${filePath}`);
  }
}

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      walk(filePath);
    } else if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      processFile(filePath);
    }
  }
}

walk(srcDir);
