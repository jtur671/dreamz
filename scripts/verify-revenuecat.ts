/**
 * Verify RevenueCat configuration
 *
 * Checks that products, entitlements, and offerings are properly
 * configured in RevenueCat by hitting their REST API.
 *
 * Run: npx tsx scripts/verify-revenuecat.ts
 */

import 'dotenv/config';

const RC_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS;

if (!RC_API_KEY) {
  console.error('EXPO_PUBLIC_REVENUECAT_API_KEY_IOS not set in .env');
  process.exit(1);
}

async function checkOfferings() {
  console.log('=== RevenueCat Configuration Check ===\n');
  console.log(`API Key: ${RC_API_KEY!.slice(0, 10)}...${RC_API_KEY!.slice(-4)}`);

  // RevenueCat v1 REST API — get offerings for an anonymous user
  // We need to create/get a subscriber first
  const appUserId = `rc_verify_test_${Date.now()}`;

  // 1. Get subscriber info (creates anonymous subscriber)
  console.log(`\n1. Creating test subscriber: ${appUserId}`);
  const subResponse = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${appUserId}`,
    {
      headers: {
        'Authorization': `Bearer ${RC_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );
  const subData = await subResponse.json();

  if (!subResponse.ok) {
    console.error('   FAIL: Could not create subscriber');
    console.error('   ', JSON.stringify(subData, null, 2));
    return;
  }
  console.log('   OK: Subscriber created');
  console.log('   Entitlements:', JSON.stringify(subData.subscriber?.entitlements || {}, null, 2));

  // 2. Get offerings
  console.log('\n2. Fetching offerings...');
  const offeringsResponse = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${appUserId}/offerings`,
    {
      headers: {
        'Authorization': `Bearer ${RC_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Platform': 'ios',
      },
    }
  );

  if (!offeringsResponse.ok) {
    const errText = await offeringsResponse.text();
    console.error(`   FAIL: ${offeringsResponse.status} ${offeringsResponse.statusText}`);
    console.error('   ', errText);
    return;
  }

  const offeringsData = await offeringsResponse.json();

  if (!offeringsData.current_offering_id) {
    console.error('   FAIL: No current offering set!');
    console.error('   Go to RevenueCat Dashboard → Offerings → set one as "Current"');
    console.log('   Raw response:', JSON.stringify(offeringsData, null, 2));
    return;
  }

  console.log(`   OK: Current offering = "${offeringsData.current_offering_id}"`);

  const offerings = offeringsData.offerings || [];
  console.log(`   Found ${offerings.length} offering(s):`);

  for (const offering of offerings) {
    console.log(`\n   Offering: "${offering.identifier}" (${offering.description || 'no description'})`);
    const packages = offering.packages || [];
    console.log(`   Packages: ${packages.length}`);

    for (const pkg of packages) {
      console.log(`     - ${pkg.identifier}: platform_product_identifier="${pkg.platform_product_identifier}"`);
    }

    if (packages.length === 0) {
      console.error('   FAIL: No packages in this offering!');
      console.error('   Go to RevenueCat Dashboard → Offerings → add packages with App Store product IDs');
    }
  }

  // 3. Summary
  console.log('\n=== Summary ===');
  const currentOffering = offerings.find((o: any) => o.identifier === offeringsData.current_offering_id);
  const pkgCount = currentOffering?.packages?.length || 0;

  if (pkgCount > 0) {
    console.log('✓ RevenueCat is configured correctly');
    console.log(`  - Current offering: "${offeringsData.current_offering_id}"`);
    console.log(`  - Packages: ${pkgCount}`);
    console.log('\nIf TestFlight users still see errors, check:');
    console.log('  1. App Store Connect → "Agreements, Tax, and Banking" is fully set up');
    console.log('  2. Subscription products are in "Ready to Submit" or "Approved" state');
    console.log('  3. Sandbox account (Settings → App Store → Sandbox Account on device)');
  } else {
    console.error('✗ RevenueCat offerings are incomplete');
    console.error('  Fix: RevenueCat Dashboard → Products → Entitlements → Offerings');
  }
}

checkOfferings().catch(console.error);
