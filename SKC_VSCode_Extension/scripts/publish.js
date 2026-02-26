#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * VS Code Extension Publishing Script
 * 
 * This script follows the official VS Code Extension Publishing guidelines:
 * https://code.visualstudio.com/api/working-with-extensions/publishing-extension
 * 
 * Features:
 * - Uses vsce (Visual Studio Code Extensions CLI) for publishing
 * - Supports version bumping (patch, minor, major)
 * - Supports pre-release publishing (--pre-release flag)
 * - Uses Personal Access Token (PAT) for authentication
 * - Provides extension details and management URLs
 * 
 * Usage:
 *   node scripts/publish.js [patch|minor|major] [--pre-release]
 * 
 * Examples:
 *   node scripts/publish.js              # Publish current version
 *   node scripts/publish.js patch       # Bump patch version and publish
 *   node scripts/publish.js --pre-release # Publish as pre-release
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Read token from .publish-token file or from environment (e.g. GitHub Actions secret VSCE_PAT)
const tokenPath = path.join(__dirname, '..', '.publish-token');
let token = process.env.VSCE_PAT || process.env.VSCODE_MARKETPLACE_TOKEN || '';

if (!token && fs.existsSync(tokenPath)) {
    token = fs.readFileSync(tokenPath, 'utf8').trim();
}

if (!token) {
    console.error('Error: No publish token found.');
    console.error('  Local: create a .publish-token file in the project root with your Personal Access Token.');
    console.error('  CI (e.g. GitHub Actions): add the token as a repository secret named VSCE_PAT.');
    process.exit(1);
}

// Read package.json to get publisher and extension name
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const publisher = packageJson.publisher;
const extensionName = packageJson.name;

// Get the version bump type from command line args (patch, minor, major, or none)
// Also support --pre-release flag as per official VS Code documentation:
// https://code.visualstudio.com/api/working-with-extensions/publishing-extension
const args = process.argv.slice(2);
const versionType = args.find(arg => ['patch', 'minor', 'major'].includes(arg)) || '';
const isPreRelease = args.includes('--pre-release');

// Build the vsce publish command according to official documentation
// Reference: https://code.visualstudio.com/api/working-with-extensions/publishing-extension
// Use npx so vsce is found from node_modules (CI and local).
let command = 'npx vsce publish';
if (versionType) {
    command += ` ${versionType}`;
}
if (isPreRelease) {
    command += ' --pre-release';
}
command += ' --allow-star-activation';
command += ` --pat ${token}`;

(async () => {
    console.log('Publishing extension...');
    console.log(`Using version bump: ${versionType || 'none (current version)'}`);
    if (isPreRelease) {
        console.log('📦 Publishing as PRE-RELEASE version');
        console.log('   Note: Pre-release versions require VS Code >= 1.63.0');
        console.log('   Reference: https://code.visualstudio.com/api/working-with-extensions/publishing-extension');
    }

    try {
        execSync(command, { stdio: 'inherit', cwd: path.join(__dirname, '..') });

        // Reload package.json to get the updated version after vsce publish
        const updatedPackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const publishedVersion = updatedPackageJson.version;
        const manageUrl = `https://marketplace.visualstudio.com/manage/publishers/${publisher}/extensions/${extensionName}/hub`;
        const publisherUrl = `https://marketplace.visualstudio.com/manage/publishers/${publisher}`;
        // Note: Public marketplace URL won't work for private extensions
        const marketplaceUrl = `https://marketplace.visualstudio.com/items?itemName=${publisher}.${extensionName}`;

        console.log('\n' + '='.repeat(70));
        console.log('✅ EXTENSION PUBLISHED SUCCESSFULLY!');
        console.log('='.repeat(70));
        console.log(`📦 Extension: ${extensionName}`);
        console.log(`👤 Publisher: ${publisher}`);
        console.log(`🔢 Version: ${publishedVersion}`);
        console.log(`\n⚙️  Manage Extension (ALWAYS WORKS):`);
        console.log(`   ${manageUrl}`);
        console.log(`\n📋 Publisher Dashboard:`);
        console.log(`   ${publisherUrl}`);
        console.log(`\n🌐 Public Marketplace (only if extension is public):`);
        console.log(`   ${marketplaceUrl}`);
        console.log(`   ⚠️  Note: This will show 404 if extension is private`);
        console.log('='.repeat(70));

        // Note: According to official VS Code documentation, extensions are private by default
        // Reference: https://code.visualstudio.com/api/working-with-extensions/publishing-extension
        // Extensions are only visible to the publisher until shared or made public via the web UI
        console.log('\n🔒 Extension Privacy:');
        console.log('   By default, extensions are private and only visible to you.');
        console.log('   To share or make public, visit the management page:');
        console.log(`   ${manageUrl}`);
        console.log('   Reference: https://code.visualstudio.com/api/working-with-extensions/publishing-extension');
        // Privacy is set via the web UI only; the marketplace API does not support
        // programmatic privacy updates (PUT returns HTTP 500 ArgumentNullException).

        // Get and display extension details (with retry since marketplace needs time to index)
        console.log('\n📦 Fetching extension details...');
        console.log('   (This may take a moment as the marketplace processes the new version...)');
        try {
            await getExtensionDetailsWithRetry(publisher, extensionName, token);
        } catch (error) {
            console.log('\n⚠️  Could not fetch extension details yet, but extension was published successfully.');
            console.log('   The extension may take a few minutes to appear in the API.');
            console.log(`\n✅ VERIFICATION STEPS:`);
            console.log(`   1. Visit publisher dashboard: ${publisherUrl}`);
            console.log(`   2. Or manage extension directly: ${manageUrl}`);
            console.log(`   3. Check that version ${publishedVersion} is listed`);
            console.log(`   4. Verify privacy settings (private extensions won't appear in public marketplace)`);
        }

        // Final success summary
        console.log('\n' + '🎉'.repeat(35));
        console.log('PUBLICATION COMPLETE!');
        console.log('🎉'.repeat(35));
        console.log(`\nYour extension "${packageJson.displayName}" v${publishedVersion} is now live!`);
        console.log(`\nNext steps:`);
        console.log(`  • Manage extension: ${manageUrl}`);
        console.log(`  • Publisher dashboard: ${publisherUrl}`);
        if (packageJson.private !== true) {
            console.log(`  • Public marketplace: ${marketplaceUrl}`);
            console.log(`  • Share with others: ext install ${publisher}.${extensionName}`);
        } else {
            console.log(`  • Note: Extension is private - not accessible via public marketplace`);
            console.log(`  • To share: Make it public in the manage page, then use: ext install ${publisher}.${extensionName}`);
        }
        console.log('');

    } catch (error) {
        console.error('\n' + '❌'.repeat(35));
        console.error('PUBLISHING FAILED!');
        console.error('❌'.repeat(35));
        console.error('\nPlease check the error messages above and try again.');
        process.exit(1);
    }
})();

/**
 * Gets extension details with retry logic (marketplace needs time to index)
 */
async function getExtensionDetailsWithRetry(publisherId, extensionId, pat, maxRetries = 5, delayMs = 3000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await getExtensionDetails(publisherId, extensionId, pat);
            return;
        } catch (error) {
            if (attempt < maxRetries) {
                const waitTime = delayMs * attempt; // Exponential backoff
                console.log(`   Attempt ${attempt}/${maxRetries} failed. Retrying in ${waitTime / 1000}s...`);
                await sleep(waitTime);
            } else {
                throw error;
            }
        }
    }
}

/**
 * Sleep utility function
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Gets and displays extension details from the marketplace
 * Uses the publisher-specific API endpoint first, then falls back to extensionquery API
 */
function getExtensionDetails(publisherId, extensionId, pat) {
    return new Promise((resolve, reject) => {
        const auth = Buffer.from(`:${pat}`).toString('base64');

        // Try the publisher-specific endpoint first
        const options = {
            hostname: 'marketplace.visualstudio.com',
            path: `/_apis/public/gallery/publishers/${publisherId}/extensions/${extensionId}?api-version=7.1-preview&includeVersions=true&includeFiles=true`,
            method: 'GET',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Accept': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        const extension = JSON.parse(data);
                        displayExtensionInfo(extension);
                        resolve();
                    } else {
                        // Try extensionquery API as fallback
                        getExtensionDetailsViaQuery(publisherId, extensionId)
                            .then(() => resolve())
                            .catch(() => {
                                // Last resort: try public API without auth
                                getExtensionDetailsPublic(publisherId, extensionId)
                                    .then(() => resolve())
                                    .catch(() => reject(new Error(`Failed to fetch extension details (HTTP ${res.statusCode})`)));
                            });
                    }
                } catch (err) {
                    // Try extensionquery API as fallback
                    getExtensionDetailsViaQuery(publisherId, extensionId)
                        .then(() => resolve())
                        .catch(() => {
                            // Last resort: try public API without auth
                            getExtensionDetailsPublic(publisherId, extensionId)
                                .then(() => resolve())
                                .catch(() => reject(err));
                        });
                }
            });
        });

        req.on('error', () => {
            // Try extensionquery API as fallback
            getExtensionDetailsViaQuery(publisherId, extensionId)
                .then(() => resolve())
                .catch(() => {
                    // Last resort: try public API without auth
                    getExtensionDetailsPublic(publisherId, extensionId)
                        .then(() => resolve())
                        .catch(() => reject(new Error('Failed to fetch extension details')));
                });
        });

        req.end();
    });
}

/**
 * Gets extension details using the extensionquery API endpoint
 * This is an alternative method documented in the Marketplace API
 */
function getExtensionDetailsViaQuery(publisherId, extensionId) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify({
            filters: [
                {
                    criteria: [
                        {
                            filterType: 7, // Publisher name
                            value: publisherId
                        },
                        {
                            filterType: 8, // Extension name
                            value: extensionId
                        }
                    ]
                }
            ],
            flags: 914 // Include all details
        });

        const options = {
            hostname: 'marketplace.visualstudio.com',
            path: '/_apis/public/gallery/extensionquery?api-version=7.1-preview',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
                'Accept': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        const result = JSON.parse(data);
                        if (result.results && result.results.length > 0 && result.results[0].extensions && result.results[0].extensions.length > 0) {
                            const extension = result.results[0].extensions[0];
                            displayExtensionInfo(extension);
                            resolve();
                        } else {
                            reject(new Error('Extension not found in query results'));
                        }
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
                    }
                } catch (err) {
                    reject(err);
                }
            });
        });

        req.on('error', (err) => reject(err));
        req.write(payload);
        req.end();
    });
}

/**
 * Gets extension details from public API (fallback)
 */
function getExtensionDetailsPublic(publisherId, extensionId) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'marketplace.visualstudio.com',
            path: `/_apis/public/gallery/publishers/${publisherId}/extensions/${extensionId}?api-version=7.1-preview&includeVersions=true`,
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        const extension = JSON.parse(data);
                        displayExtensionInfo(extension);
                        resolve();
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}`));
                    }
                } catch (err) {
                    reject(err);
                }
            });
        });

        req.on('error', (err) => reject(err));
        req.end();
    });
}

/**
 * Displays extension information in a formatted way
 */
function displayExtensionInfo(extension) {
    console.log('\n' + '='.repeat(60));
    console.log('📦 EXTENSION DETAILS');
    console.log('='.repeat(60));

    if (extension.extensionName) {
        console.log(`Name: ${extension.extensionName}`);
    }
    if (extension.displayName) {
        console.log(`Display Name: ${extension.displayName}`);
    }
    if (extension.publisher && extension.publisher.publisherName) {
        console.log(`Publisher: ${extension.publisher.publisherName}`);
    }
    if (extension.shortDescription) {
        console.log(`Description: ${extension.shortDescription}`);
    }

    // Versions
    if (extension.versions && extension.versions.length > 0) {
        const latestVersion = extension.versions[0];
        console.log(`\nLatest Version: ${latestVersion.version}`);
        if (latestVersion.lastUpdated) {
            const date = new Date(latestVersion.lastUpdated);
            console.log(`Published: ${date.toLocaleString()}`);
        }
        console.log(`Total Versions: ${extension.versions.length}`);
    }

    // Statistics
    if (extension.statistics) {
        console.log('\n📊 Statistics:');
        extension.statistics.forEach(stat => {
            if (stat.statisticName === 'install') {
                console.log(`  Installs: ${stat.value || 0}`);
            } else if (stat.statisticName === 'rating') {
                console.log(`  Rating: ${stat.value || 'N/A'}`);
            } else if (stat.statisticName === 'ratingCount') {
                console.log(`  Rating Count: ${stat.value || 0}`);
            }
        });
    }

    // Flags (privacy status)
    // Flags can be: string "Private", number (bitmask where 1 = Private), or array
    let privacyStatus = 'Unknown';
    if (extension.flags !== undefined && extension.flags !== null) {
        if (typeof extension.flags === 'string') {
            privacyStatus = (extension.flags.includes('Private') || extension.flags === 'Private') ? 'Private' : 'Public';
        } else if (typeof extension.flags === 'number') {
            // Bitmask: 1 = Private, 0 = Public
            privacyStatus = (extension.flags & 1) === 1 ? 'Private' : 'Public';
        } else if (Array.isArray(extension.flags)) {
            privacyStatus = extension.flags.includes('Private') ? 'Private' : 'Public';
        }
    } else if (extension.published !== undefined) {
        // Some API responses use a 'published' boolean field
        privacyStatus = extension.published ? 'Public' : 'Private';
    }
    console.log(`\n🔒 Privacy: ${privacyStatus}`);

    // URLs
    console.log('\n🔗 Links:');
    const publisherName = extension.publisher?.publisherName || extension.publisher;
    const extName = extension.extensionName || extension.name;
    if (publisherName && extName) {
        console.log(`  Marketplace: https://marketplace.visualstudio.com/items?itemName=${publisherName}.${extName}`);
        console.log(`  Manage: https://marketplace.visualstudio.com/manage/publishers/${publisherName}/extensions/${extName}/hub`);
    }

    console.log('='.repeat(60) + '\n');
}

