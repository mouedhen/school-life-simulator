/* engine/14_api.js — The public object E (globalThis.Engine in the browser, module.exports in Node). */
'use strict';
/* ---------- public API ---------- */
const E = {
  // lookups and data
  isMet, metKids, metOf, itemLocked, phoneCan, applyFx, fxs, D, CH, KIDS, FAM, TEACH, DAYS, DAYIDX, SHOP, JOBS, INTER,
  ENDINGS, ENDBY, RAND, SPECIAL, HOLIDAYS, BALL_DAY,
  // game flow, free time, people, phone
  newGame, buildEvent, choose, endDay, study, work, buy, useItem, giveGift, giftItems, interactionList, interact,
  phoneList, phoneAct, phoneReply, phoneOf, PHONE_HIDE, PHONE_CAP, PH_MC, phoneOff, GROUPS, GC_ACTS, GC_SAY, GC_NICE, GC_FAM,
  phoneGroupList, phoneGroupAct, phoneGame, PG_GAP, relLabel, rumorsFor,
  // family, cooking, mystery, endings, helpers
  BONDS, bond, bondOk, GIFTS, RECIPES, cook, cookLevel, cookPrice, recipeOk, THOUGHTS, noteStrange, mystStage, REVEAL_AT,
  npcActs, dayOf, ballScene, acadChance, quiz, hintsFor, checks, evaluateEnding, stats, hash, mul, F, ballChance, advance,
  rnd, likeScore,
};
globalThis.Engine = E;
