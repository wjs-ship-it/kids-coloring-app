// Keep existing IDs and category positions while pairing glyphs with exact paths.
export function applyWritingGuides(items) {
  const result = items.map(item => {
    if (!['letters', 'numbers'].includes(item.category)) return item;
    const character = item.name.split(' ').at(-1);
    return { ...item, activity: 'trace',
      src: `./assets/writing-guides/${character}.svg`,
      traceSrc: `./assets/writing-guides/${character}.json` };
  });
  result.splice(result.findIndex(item => item.category === 'numbers'), 0,
    {id:'writing-number-0',name:'숫자 0',category:'numbers',activity:'trace',
    src:'./assets/writing-guides/0.svg',traceSrc:'./assets/writing-guides/0.json'});
  return result;
}
