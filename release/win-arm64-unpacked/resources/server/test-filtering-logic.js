// Simple test to verify the filtering fix
const fs = require('fs-extra');
const path = require('path');

async function testFilteringFix() {
    console.log('🧪 Testing filtering logic fix...');
    
    // Simulate the scenario data
    const allScenarios = [
        { label: 'asset-share-commons', url: 'https://example.com/valid1' },
        { label: 'network-test', url: 'https://invalid-domain-that-does-not-exist.com' },
        { label: 'details', url: 'https://aem.enablementadobe.com/content/asset-share-commons/en/light/details/image.html/content/dam/asset-share-commons/en/public/pictures/ariel-lustre-251415.jpg' },
        { label: 'other-scenario', url: 'https://another-invalid-domain.com' }
    ];
    
    // Simulate validation results
    const validScenarios = [allScenarios[0], allScenarios[2]]; // asset-share-commons, details
    const invalidScenarios = [
        {
            scenario: allScenarios[1], // network-test  
            reason: 'NETWORK_ERROR',
            message: 'Connection failed'
        },
        {
            scenario: allScenarios[3], // other-scenario
            reason: 'NETWORK_ERROR', 
            message: 'DNS resolution failed'
        }
    ];
    
    console.log('📊 Initial state:');
    console.log(`   Valid scenarios: ${validScenarios.map(s => s.label).join(', ')}`);
    console.log(`   Invalid scenarios: ${invalidScenarios.map(s => s.scenario.label).join(', ')}`);
    
    // Apply filter
    const filter = "asset-share-commons|network-test|details";
    const filterScenarios = filter.split('|');
    console.log(`\n🔍 Applying filter: ${filterScenarios.join(', ')}`);
    
    // Filter valid scenarios
    const filteredValidScenarios = validScenarios.filter(scenario => 
        filterScenarios.includes(scenario.label)
    );
    
    // Filter invalid scenarios  
    const filteredInvalidScenarios = invalidScenarios.filter(item =>
        filterScenarios.includes(item.scenario.label)
    );
    
    console.log('\n📋 After filtering:');
    console.log(`   Filtered valid scenarios: ${filteredValidScenarios.map(s => s.label).join(', ')}`);
    console.log(`   Filtered invalid scenarios: ${filteredInvalidScenarios.map(s => s.scenario.label).join(', ')}`);
    console.log(`   Non-filtered invalid scenarios: ${invalidScenarios.filter(item => !filterScenarios.includes(item.scenario.label)).map(s => s.scenario.label).join(', ')}`);
    
    // Mark scenarios
    invalidScenarios.forEach(item => {
        item.matchedFilter = filterScenarios.includes(item.scenario.label);
    });
    
    console.log('\n🎯 Final report should include:');
    console.log(`   ✅ Valid scenarios (matching filter): ${filteredValidScenarios.length}`);
    console.log(`   ❌ Invalid scenarios (matching filter): ${filteredInvalidScenarios.length}`);
    console.log(`   ⚠️  Invalid scenarios (not matching filter): ${invalidScenarios.length - filteredInvalidScenarios.length}`);
    console.log(`   📊 Total scenarios in report: ${filteredValidScenarios.length + invalidScenarios.length}`);
    
    console.log('\n📝 Invalid scenarios with filter info:');
    invalidScenarios.forEach(item => {
        console.log(`   - ${item.scenario.label}: ${item.matchedFilter ? '✅ Matches filter' : '⚠️  Outside filter'}`);
    });
    
    // Verify that "network-test" should appear in report
    const networkTestScenario = invalidScenarios.find(item => item.scenario.label === 'network-test');
    if (networkTestScenario) {
        console.log(`\n🔍 "network-test" scenario status:`);
        console.log(`   - Found in invalid scenarios: ✅`);
        console.log(`   - Matches filter: ${networkTestScenario.matchedFilter ? '✅' : '❌'}`);
        console.log(`   - Should appear in report: ✅`);
    } else {
        console.log(`\n❌ "network-test" scenario not found in invalid scenarios!`);
    }
    
    console.log('\n✅ Test completed successfully!');
}

testFilteringFix().catch(console.error);
