#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

console.log('🔍 Testing Node-RED Panel Plugin Installation');
console.log('============================================');

// Test 1: Check package.json
console.log('\n1. Checking package.json...');
const packagePath = path.join(__dirname, 'package.json');
if (fs.existsSync(packagePath)) {
    const pkg = require('./package.json');
    console.log('✅ Package name:', pkg.name);
    console.log('✅ Version:', pkg.version);
    console.log('✅ Node-RED nodes:', Object.keys(pkg['node-red'].nodes).join(', '));
} else {
    console.log('❌ package.json not found');
    process.exit(1);
}

// Test 2: Check main files
console.log('\n2. Checking main files...');
const mainFiles = [
    'lib/panel.js',
    'lib/panel.html',
    'lib/database/db.js',
    'lib/database/schema.js',
    'lib/api/router.js'
];

let allFilesExist = true;
mainFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        console.log(`✅ ${file}`);
    } else {
        console.log(`❌ ${file} not found`);
        allFilesExist = false;
    }
});

// Test 3: Check Vue build
console.log('\n3. Checking Vue admin build...');
const vueBuildPath = path.join(__dirname, 'lib/admin/dist/index.html');
if (fs.existsSync(vueBuildPath)) {
    console.log('✅ Vue admin UI built');
} else {
    console.log('❌ Vue admin UI not built - run "cd lib/admin && npm run build"');
    allFilesExist = false;
}

// Test 4: Check dependencies
console.log('\n4. Checking dependencies...');
const nodeModulesPath = path.join(__dirname, 'node_modules');
if (fs.existsSync(nodeModulesPath)) {
    console.log('✅ Dependencies installed');
} else {
    console.log('❌ Dependencies not installed - run "npm install"');
    allFilesExist = false;
}

// Test 5: Try to load main module
console.log('\n5. Testing module loading...');
try {
    const mockRED = {
        nodes: { registerType: () => {}, createNode: function() {} },
        events: { on: () => {} },
        httpAdmin: null,
        httpNode: null,
        settings: { userDir: __dirname }
    };
    
    // Don't actually run the module, just test if it can be required
    const panelModule = require('./lib/panel.js');
    console.log('✅ Module loads without syntax errors');
} catch (error) {
    console.log('❌ Module loading failed:', error.message);
    allFilesExist = false;
}

console.log('\n📋 Summary');
console.log('==========');
if (allFilesExist) {
    console.log('✅ All tests passed! Plugin is ready for installation.');
    console.log('\n📝 Next steps:');
    console.log('1. Copy this folder to ~/.node-red/node_modules/node-red-contrib-panel');
    console.log('2. Restart Node-RED');
    console.log('3. Access the admin panel at http://localhost:1880/panel');
    console.log('4. Import the example flow from examples/basic-crud-flow.json');
} else {
    console.log('❌ Some tests failed. Please fix the issues above.');
    process.exit(1);
}