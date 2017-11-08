/**
 * ランキングのボーダーを通知するやつ
 **/

/*
 * パッケージ
 */
const rp = require('request-promise');
const cheerio = require('cheerio');
const logger = require('./logger');
const fs = require('fs');
const jsondiffpatch = require('jsondiffpatch');
require('date-util');
const yesterday = new Date().strtotime('-1 day').format('yyyy年mm月dd日更新');
const { forEach } = require('p-iteration');

const CONF = require('config');
CONF.kkt.BAERERTOKEN = process.env.NODE_KKT_TOKEN; // kktのトークン

/*
 * プログラム
 */
// 必要な環境変数がセットされてるかチェックする
function init() {
  if (!CONF.kkt.BAERERTOKEN) {
    logger.system.fatal('KKTトークン未設定');
    return false;
  }
  return true;
}

// キラキラッターにカツする
function actKatsu(katsuContent, visibility) {
  logger.system.debug(JSON.stringify(katsuContent, null, '  '));

  const katsuBody = {
    'status': katsuContent,
    'in_reply_to_id': null,
    'media_ids': null,
    'sensitive': null,
    'spoiler_text': '',
    'visibility': visibility
  };

  // リクエストの生成
  const options = {
    'method': 'POST',
    'uri': 'https://kirakiratter.com/api/v1/statuses',
    'body': katsuBody,
    'headers': {
      'Authorization': 'Bearer ' + CONF.kkt.BAERERTOKEN,
      'Content-type': 'application/json'
    },
    'json': true
  };

  rp(options)
    .then(parsedBody => {
      logger.system.info(parsedBody.url);
      logger.system.debug(parsedBody);
    })
    .catch(err => {
      logger.system.error(err);
    });
}

// 指定されたURLからランキング情報を取得する
async function getRankList(uri) {
  try {
    const options = {
      'uri': uri,
      'transform': body => { return cheerio.load(body); }
    };

    const rankList = [];
    const $ = await rp(options);

    // ランキング情報を取得
    $('.first-rank, .high-rank, .low-rank').each((index, val) => {
      rankList.push({
        'rank': $(val).find('.player-rank').eq(1).text().slice(0, -1),
        'name': $(val).find('.name').eq(1).text(),
        'score': $(val).find('.appeal-point').eq(1).text().trim(),
        'updateDate': $(val).find('.update').eq(1).text()
      });
    });
    // logger.system.debug('[getRankList][rankList]\n' + JSON.stringify(rankList, null, '  '));
    return await rankList;
  } catch (e) {
    logger.system.error(e);
  }
}

// メインだよ
async function main() {

  try {
    let rankInfo = [];
    for (let rank of CONF.ranks) {
      let areaInfo = [];
      for (let area of CONF.areas) {

        // URIを指定してランキング情報を取得する
        const uri = 'http://www.aikatsu.com/stars/ranking/aikatsu_cup_ranking.php?series=' + CONF.series + '&r_type=' + CONF.r_type + '&tournament=' + area.area_id + '&p=' + rank.page_id;
        let userList = await getRankList(uri);
        logger.system.debug('[main][userList]\n' + JSON.stringify(userList, null, '  '));

        // 該当のランクだけ取り出す
        let user = [];
        if (typeof userList === 'object' && userList.length > 1) {
          user = userList.filter((item) => {
            if (item.rank === rank.rank) return true;
          });
        }
        let score;
        if (user.length === 1) {
          score = user[0].score;
        } else {
          score = '取得できませんでした。';
        }
        await areaInfo.push({ 'name': area.area_name, 'score': score });
      }
      await rankInfo.push({ 'rank': rank.rank, 'area': areaInfo });
    }
    logger.system.debug('[main][rankInfo]\n' + JSON.stringify(rankInfo, null, '  '));

    // カツ用に整形する
    let katsuContent = '[bot]アイドル一番星☆決定戦\n予選ランキングスコア\n';
    for (let rank of rankInfo) {
      katsuContent += '[' + rank.rank + '位]\n';
      for (let area of rank.area) {
        katsuContent += area.name + '：' + area.score + '\n';
      }
      katsuContent += '\n';
    }
    logger.system.debug('[main][katsuContent]\n' + katsuContent);

    actKatsu(katsuContent, CONF.kkt.VISIBILITY);
  } catch (e) {
    logger.system.error(e);
  }

}

// メイン処理
if (init()) {
  logger.system.info('【ARBN】プログラム、始まります！ﾌﾌｯﾋ');
  main();
}
