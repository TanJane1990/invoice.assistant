/**
 * Convert number to Chinese RMB capital string (数字转人民币大写)
 * e.g. 1250.5 => 壹仟贰佰伍拾元伍角整
 */
export function numberToRMB(money: number): string {
  if (!money || typeof money !== "number" || isNaN(money) || money === 0) {
    return "零元整";
  }

  const cnNums = ["零", "壹", "贰", "叁", "肆", "伍", "陆", "柒", "捌", "玖"];
  const cnIntRadice = ["", "拾", "佰", "仟"];
  const cnIntUnits = ["", "万", "亿", "兆"];
  const cnDecUnits = ["角", "分", "毫", "厘"];
  const cnInteger = "整";
  const cnIntLast = "元";

  const maxNum = 999999999999.99;
  let integerNum: string;
  let decimalNum: string;
  let chineseStr = "";

  if (money > maxNum) {
    return "超出最大转换金额";
  }

  let moneyStr = Math.abs(money).toFixed(2);
  const parts = moneyStr.split(".");
  integerNum = parts[0];
  decimalNum = parts[1];

  if (parseInt(integerNum, 10) > 0) {
    let zeroCount = 0;
    const IntLen = integerNum.length;
    for (let i = 0; i < IntLen; i++) {
      const n = integerNum.substring(i, i + 1);
      const p = IntLen - i - 1;
      const q = Math.floor(p / 4);
      const m = p % 4;
      if (n === "0") {
        zeroCount++;
      } else {
        if (zeroCount > 0) {
          chineseStr += cnNums[0];
        }
        zeroCount = 0;
        chineseStr += cnNums[parseInt(n, 10)] + cnIntRadice[m];
      }
      if (m === 0 && zeroCount < 4) {
        chineseStr += cnIntUnits[q];
      }
    }
    chineseStr += cnIntLast;
  }

  if (decimalNum !== "") {
    const decLen = decimalNum.length;
    for (let i = 0; i < decLen; i++) {
      const n = decimalNum.substring(i, i + 1);
      if (n !== "0") {
        chineseStr += cnNums[parseInt(n, 10)] + cnDecUnits[i];
      }
    }
  }

  if (chineseStr === "") {
    chineseStr += cnNums[0] + cnIntLast + cnInteger;
  } else if (decimalNum === "00" || decimalNum === "") {
    chineseStr += cnInteger;
  }

  return chineseStr;
}
