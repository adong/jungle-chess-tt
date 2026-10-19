/* 中文 for TT Jungle Chess (斗兽棋): the words on the page, the toasts, the canvas words (the animals' names on their
   badges, the word bursts) and the ? panel (Kit.lang, from kit/lang.js). Simple words: Tommy is 5. The animals use their
   classic names (象 狮 虎 豹 狼 狗 猫 鼠), with 河, 陷阱 and 兽穴. The kids' and friends' names and the game's own
   name stay English. */
(function () {
  const L = Kit.lang;
  L.keep(['TT Jungle Chess', 'TT', 'Jungle Chess', 'TEDDY', 'TOMMY', 'BOLT', 'BRUNO', 'Teddy', 'Tommy', 'Esc', 'Enter', 'Space', 'Backspace']);

  const ANIMAL = { RAT: '鼠', CAT: '猫', DOG: '狗', WOLF: '狼', LEOPARD: '豹', TIGER: '虎', LION: '狮', ELEPHANT: '象' };
  L.add(ANIMAL); // the names on the badges (js/stage.js draws them through Kit.lang.t)

  L.add({
    // the menu
    PLAY: '开始玩', 'Play': '开始玩', 'Play (Enter)': '开始玩 (Enter)',
    'WHO BEATS WHO?': '谁吃谁？', 'Who beats who?': '谁吃谁？', 'Who beats who? (R)': '谁吃谁？(R)',
    '1 PLAYER': '1 人玩', '2 PLAYERS': '2 人玩', 'Players': '几个人玩', 'Who are you?': '你是谁？', 'Level': '难度',
    'UNDO ON': '可以悔棋', 'UNDO OFF': '不能悔棋', 'Undo button': '悔棋按钮',
    // while playing
    'Pause': '暂停', 'Pause (P)': '暂停 (P)', 'Sound (M)': '声音 (M)', 'Sound on or off': '声音 开 / 关',
    'Undo': '悔棋', 'Undo (U)': '悔棋 (U)',
    'Call your brother': '叫兄弟来帮忙', 'High five!': '击掌！', 'High five! (T)': '击掌！(T)', 'HIGH FIVE! 🙌': '击掌！🙌',
    'YOUR TURN!': '轮到你啦！', 'DRAW!': '平局！', '1 MOVE LEFT': '还剩 1 步',
    "THIS ONE CAN'T MOVE!": '这个走不了！', 'A RAT IS IN THE WAY!': '河里有鼠挡着！', 'NOT YOUR OWN DEN!': '不能进自己的兽穴！',
    'ONLY THE RAT CAN SWIM!': '只有鼠会游泳！', 'CLIMB OUT OF THE WATER FIRST!': '先爬上岸！', "HE'S SAFE IN THE WATER!": '它在河里，吃不到！',
    "THE ELEPHANT CAN'T BONK THE RAT!": '象不能吃鼠！', 'TOO BIG TO BONK!': '它太大啦，吃不了！',
    // the game is over, pause
    'INTO THE DEN!': '走进兽穴啦！', 'BONKED THEM ALL!': '全部吃光啦！', 'NO MOVES LEFT!': '没有棋可以走啦！', 'TOO MANY MOVES!': '走太多步啦！',
    'Home': '主页', 'Play again': '再玩一次', 'PLAY AGAIN': '再玩一次', 'Keep playing': '继续玩', 'Start a new game': '重新开始',
    // the rules screen
    'Bigger number bonks smaller. The same number bonks too!': '大数字吃小数字，一样大也能吃！',
    'THE RAT BEATS THE ELEPHANT!': '鼠能吃象！',
    "But the elephant can't beat the rat.": '可是象不能吃鼠。',
    'ONLY THE RAT CAN SWIM.': '只有鼠会游泳。',
    "In the water he's safe from land animals, and he can't bonk anyone on land from there.": '鼠在河里，岸上的动物吃不到它；它在河里也不能吃岸上的动物。',
    'THE LION AND THE TIGER JUMP THE RIVER.': '狮和虎能跳过河。',
    'A rat in the water blocks the jump.': '河里有鼠挡着，就跳不过去。',
    'IN YOUR TRAP THEY ARE 0.': '掉进你的陷阱，就变成 0。',
    'Any of your animals can bonk them there.': '你的任何一个动物都能吃掉它。',
    'WALK INTO THEIR DEN TO WIN!': '走进对方的兽穴就赢啦！',
    "You can't go into your own den. Bonking all their animals wins too.": '自己的兽穴不能进。吃光对方的动物也能赢。',
    'ONE SQUARE AT A TIME.': '一次走一格。',
    'Up, down, left or right. Tap an animal to see where it can go.': '上、下、左、右都可以。点一下动物，看看它能走到哪里。',
    'Got it': '知道啦',
    // canvas word bursts over the board (js/stage.js and js/game.js, through Kit.lang.t)
    'BONK!': '咚！', 'BOING!': '嘣！', 'DEN!': '进穴！', 'ALL BONKED!': '吃光啦！', 'STUCK!': '走不动！',
    // the ? panel (js/keys.js)
    'pick up your animal by its number (1 rat … 8 elephant)': '按数字拿起你的动物（1 鼠 … 8 象）',
    'move round the board · pick up or put down': '在棋盘上移动 · 拿起或放下',
    'put the animal back': '把动物放回去',
    'undo your last move': '悔一步棋',
    'call your brother (2 players: high five)': '叫兄弟来帮忙（2 人玩：击掌）',
    'who beats who? (the rules)': '谁吃谁？（规则）',
    'new game': '新的一局',
    'menu: play · Teddy or Tommy · 1 or 2 players': '菜单：开始 · Teddy 还是 Tommy · 1 人或 2 人',
    'menu: level · undo on or off': '菜单：难度 · 悔棋 开 / 关',
    'Bigger number bonks smaller, and the same number bonks too. 🐭 beats 🐘! Walk into their den to win.':
      '大数字吃小数字，一样大也能吃。🐭 能吃 🐘！走进对方的兽穴就赢啦。',
    "Tap an animal, then tap a glowing square. Tap your brother's face (bottom right) to call him.":
      '先点一个动物，再点发光的格子。点右下角兄弟的头像，叫他来帮忙。',
  });

  const A = 'RAT|CAT|DOG|WOLF|LEOPARD|TIGER|LION|ELEPHANT';
  const TREAT = { 'ICE CREAM': '冰淇淋', WATER: '水', 'JUICE BOX': '果汁', COOKIE: '饼干', WATERMELON: '西瓜', BANANA: '香蕉' };
  L.rule(/^Call (\S+) \(T\)$/, '叫 $1 (T)');
  L.rule(/^Call (\S+)$/, '叫 $1');
  L.rule(/^(\S+)'S HERE!$/, '$1 来啦！');
  L.rule(new RegExp(`^(\\S+) SAYS: MOVE THE (${A})!$`), (m, who, a) => `${who} 说：快走${ANIMAL[a]}！`);
  L.rule(new RegExp(`^(\\S+) SAYS: BONK THE (${A}) AND WIN!$`), (m, who, a) => `${who} 说：吃掉${ANIMAL[a]}就赢啦！`);
  L.rule(new RegExp(`^(\\S+) SAYS: BONK THE (${A})!$`), (m, who, a) => `${who} 说：吃掉${ANIMAL[a]}！`);
  L.rule(new RegExp(`^(\\S+) SAYS: YOUR (${A}) IS IN DANGER!$`), (m, who, a) => `${who} 说：你的${ANIMAL[a]}有危险！`);
  L.rule(/^(\S+) SAYS: GUARD YOUR DEN!$/, '$1 说：守住你的兽穴！');
  L.rule(/^(\S+) SAYS: GO IN THE DEN!$/, '$1 说：走进兽穴！');
  L.rule(new RegExp(`^YOUR (${A}) IS NAPPING!$`), (m, a) => `你的${ANIMAL[a]}在睡觉！`);
  L.rule(/^(\S+) IS THINKING…$/, '$1 在想…');
  L.rule(/^(\S+)'S TURN!$/, '轮到 $1！');
  L.rule(/^(\S+) WINS!$/, '$1 赢啦！');
  L.rule(/^(\d+) MOVES LEFT$/, '还剩 $1 步');
  L.rule(/^(\S+) (ICE CREAM|WATER|JUICE BOX|COOKIE|WATERMELON|BANANA) FROM (\S+)!$/, (m, emoji, item, who) => `${emoji} ${who} 给你${TREAT[item]}！`);
})();
