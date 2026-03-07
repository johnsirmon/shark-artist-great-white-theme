const fs = require('fs');
let content = fs.readFileSync('themes/great-white-bloodloss-color-theme.json', 'utf8');

/*
Backgrounds:
#111820 -> #1a0505 (deep red bg)
#142632 -> #2d080a (line highlight)

Accents/Keywords:
#4f7ea8 -> #c44f5f
#9fc7d8 -> #e06b7a
#9dc4ea -> #ff8a98

Selection/UI:
#1e4460 -> #4a0f14
#2a3e56 -> #66151c

Indents:
#1c3d52 -> #3d0a0e
#3f708a -> #85212a
*/

content = content.replace(/"name": "Great White \(Storm\)"/g, '"name": "Great White (Bloodloss)"');
content = content.replace(/#111820/gi, '#1a0505');
content = content.replace(/#142632/gi, '#2d080a');
content = content.replace(/#4f7ea8/gi, '#c44f5f');
content = content.replace(/#9fc7d8/gi, '#e06b7a');
content = content.replace(/#9dc4ea/gi, '#ff8a98');
content = content.replace(/#1e4460/gi, '#4a0f14');
content = content.replace(/#2a3e56/gi, '#66151c');
content = content.replace(/#1c3d52/gi, '#3d0a0e');
content = content.replace(/#3f708a/gi, '#85212a');

fs.writeFileSync('themes/great-white-bloodloss-color-theme.json', content);
console.log('Bloodloss theme formulated.');