const fs = require('fs');

let content = fs.readFileSync('lib/grants-data.ts', 'utf8');

// 1. Update the exported type
content = content.replace(
  /export type Benefit =[\s\S]*?;/,
  `export type Benefit =
  | 'Nutrient & Fertilizer Management'
  | 'Soil Health & Carbon'
  | 'Climate Resilience'
  | 'Water Quality & Conservation'
  | 'Crop Yield & Vigor'
  | 'On-Farm Trials & Research'
  | 'Specialty Crops';`
);

// 2. Map old string values to new string values
const map = {
  'Fertilizer Reduction': 'Nutrient & Fertilizer Management',
  'Nitrogen Uptake': 'Nutrient & Fertilizer Management',
  'Soil Health': 'Soil Health & Carbon',
  'Drought Tolerance': 'Climate Resilience',
  'Cold Resistance': 'Climate Resilience',
  'Yield Improvement': 'Crop Yield & Vigor',
  'Stand Improvement': 'Crop Yield & Vigor',
  'Germination': 'Crop Yield & Vigor',
  'General': 'On-Farm Trials & Research',
  'Expected': 'On-Farm Trials & Research'
};

for (const [oldVal, newVal] of Object.entries(map)) {
  const regex = new RegExp(`'${oldVal}'`, 'g');
  content = content.replace(regex, `'${newVal}'`);
}

// 3. Optional: apply context-based categories (Water Quality & Specialty Crops) using regex over each grant block
const grantBlockRegex = /({[\s\S]*?id:\s*'[^']*'[\s\S]*?name:\s*'[^']*'[\s\S]*?description:\s*'([^']*)'[\s\S]*?})/g;
content = content.replace(grantBlockRegex, (match, block, description) => {
    let lowerDesc = description.toLowerCase();
    let additions = [];
    if (lowerDesc.includes('water') || lowerDesc.includes('runoff') || lowerDesc.includes('erosion') || lowerDesc.includes('sediment')) {
        additions.push('Water Quality & Conservation');
    }
    if (lowerDesc.includes('specialty crop') || lowerDesc.includes('fruit') || lowerDesc.includes('vegetable')) {
        additions.push('Specialty Crops');
    }
    if (lowerDesc.includes('trial') || lowerDesc.includes('demo') || lowerDesc.includes('research')) {
        additions.push('On-Farm Trials & Research');
    }

    if (additions.length > 0) {
        // Find existing benefits
        let newBlock = block.replace(/benefits:\s*\[(.*?)\]/, (bMatch, bContent) => {
            let items = bContent.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
            let combined = [...new Set([...items, ...additions])];
            return `benefits: [${combined.map(bx => `'${bx}'`).join(', ')}]`;
        });
        return newBlock;
    }
    return match;
});

// 4. Deduplicate (Nutrient & Fertilizer might appear twice in the same array now)
content = content.replace(/benefits:\s*\[(.*?)\]/g, (match, p1) => {
    let items = p1.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
    let unique = [...new Set(items)];
    return `benefits: [${unique.map(s => `'${s}'`).join(', ')}]`;
});

fs.writeFileSync('lib/grants-data.ts', content);
console.log('Categories updated successfully!');
