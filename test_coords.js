const fs = require('fs');
const vm = require('vm');

// Load game_core.js content
const gameCoreCode = fs.readFileSync('game_core.js', 'utf8');

// Create a sandbox
const sandbox = {
    console: console
};

// Execute game_core.js in sandbox to populate it
vm.createContext(sandbox);
vm.runInContext(gameCoreCode, sandbox);

// Access CoordinateConverter via the global scope if exposed, or we need to check how it's exposed.
// game_core.js uses (function(global) { ... })(this);
// So 'this' in validation context might be sandbox.

const core = sandbox.MoleChessCore || sandbox;

// Check n2a function (it's not directly exposed on global usually, but let's check game_core.js structure)
// It exposes: global.MoleChessCore = { ... n2a ... }

if (sandbox.MoleChessCore) {
    const { n2a, a2n } = sandbox.MoleChessCore;

    console.log("Testing Coordinate Conversion (0-based rows):");

    const t1 = n2a(0, 0);
    console.log(`n2a(0, 0) = ${t1} (Expected: a0)`);

    const t2 = n2a(11, 11);
    console.log(`n2a(11, 11) = ${t2} (Expected: l11)`);

    const t3 = a2n('a0');
    console.log(`a2n('a0') = [${t3}] (Expected: [0, 0])`);

    const t4 = a2n('l11');
    console.log(`a2n('l11') = [${t4}] (Expected: [11, 11])`);

    if (t1 === 'a0' && t2 === 'l11' && t3[0] === 0 && t4[0] === 11) {
        console.log("✅ Verification PASSED");
    } else {
        console.log("❌ Verification FAILED");
    }

} else {
    console.error("MoleChessCore not found in sandbox");
}
