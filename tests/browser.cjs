// Optional: requires Playwright + Chromium. Gameplay itself has no dependencies.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL ? {channel:process.env.BROWSER_CHANNEL} : {})});
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const out=path.resolve(__dirname,'../qa');fs.mkdirSync(out,{recursive:true});
  const shot=name=>page.screenshot({path:path.join(out,name+'.png')});
  const state=()=>page.evaluate(()=>({mode:__game.mode,room:__game.room,screen:__game.battle?.screen,portal:!!__game.portal}));
  const sayAll=async()=>{let count=0;while((await state()).mode==='dialogue'&&count++<15)await page.locator('#next-dialogue').click();};
  async function approach(x,y) {await page.evaluate(([x,y])=>{__game.player.x=x;__game.player.y=y;__game.update(.02);},[x,y]);}
  async function answerAction(action) {
    await page.locator(`[data-action="${action}"]`).click();
    const answer=await page.evaluate(()=>__game.battle.challenge.answer);
    await page.locator('#answer').fill(String(answer));await page.locator('#answer-form button[type=submit]').click();
  }
  try {
    await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href+'?test=1');
    await page.waitForFunction(()=>window.__game);
    await shot('01-menu');
    await page.locator('[data-menu="controls"]').click();assert(await page.locator('#modal').isVisible());await page.keyboard.press('Escape');
    await page.locator('[data-menu="play"]').click();await shot('02-tutorial');
    const before=await page.evaluate(()=>__game.player.x);
    await page.keyboard.down('d');await page.waitForTimeout(200);await page.keyboard.up('d');
    assert((await page.evaluate(()=>__game.player.x))>before);
    await approach(505,272);await page.keyboard.press('e');await sayAll();
    assert.equal((await state()).mode,'choice');await page.locator('#skip').click();await sayAll();
    assert((await state()).portal);await approach(596,274);
    await page.waitForFunction(()=>__game.room==='rm_cavernas'&&__game.mode==='dialogue');
    await shot('03-newton-transmission');await sayAll();await page.waitForTimeout(350);await shot('04-cavern-forest');
    await approach(617,301);await page.waitForFunction(()=>__game.room==='rm_cavernas_2');
    await page.waitForTimeout(350);await shot('05-cavern-valley');
    await approach(407,300);await sayAll();
    assert.equal((await state()).mode,'battle');
    await page.evaluate(()=>{__game.battle.rng=()=>.5;});
    await page.locator('[data-action="attack"]').click();await shot('06-math-challenge');
    await page.locator('#answer').fill('999');await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(()=>__game.battle.enemyHp),75);
    for(let i=0;i<5;i++)await answerAction('attack');
    assert.equal((await state()).screen,'victory');await shot('07-victory');
    await page.locator('#result-next').click();assert.equal((await state()).mode,'dialogue');
    assert.equal((await state()).portal,false);await sayAll();
    assert.equal((await state()).mode,'explore');assert.equal((await state()).portal,true);
    await page.waitForTimeout(650);assert.equal((await state()).mode,'explore');
    await approach(525,300);await page.waitForFunction(()=>__game.mode==='meteor');await shot('08-meteor');
    await page.waitForFunction(()=>__game.mode==='aftermath');await shot('09-aftermath');
    await page.waitForFunction(()=>__game.sceneTime>=2);await page.keyboard.press('Enter');
    assert.equal((await state()).mode,'menu');
    // Full guided-training path, retry semantics, and desktop/mobile layout.
    await page.locator('[data-menu="play"]').click();await approach(505,272);await page.keyboard.press('e');await sayAll();await page.locator('#train').click();
    await page.evaluate(()=>{__game.battle.rng=()=>.5;});
    for(const action of ['attack','heal','defense','dodge'])await answerAction(action);
    assert.equal(await page.evaluate(()=>__game.battle.guided),false);
    assert.equal(await page.evaluate(()=>__game.battle.phase),5);
    await shot('10-newton-training');
    while((await state()).screen==='actions') {
      const hp=await page.evaluate(()=>__game.battle.playerHp);
      await answerAction(hp<35?'heal':'attack');
    }
    assert.equal((await state()).screen,'victory');await page.locator('#result-next').click();await sayAll();assert((await state()).portal);
    await page.keyboard.press('Escape');assert(await page.locator('#modal').isVisible());await page.locator('#return-menu').click();
    await page.setViewportSize({width:390,height:844});await shot('11-mobile-menu');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.deepEqual(errors,[]);
    console.log('Browser PASS: offline file:// loading; keyboard; skip and full tutorial; cave transitions; boss battle; Newton warning; portal-gated meteor; aftermath; pause; mobile layout. No page errors.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
