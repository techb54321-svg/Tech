/* ============================================================
   Real Food Rewards — culture content packs
   ------------------------------------------------------------
   ONE place to edit per-community content. All pages read this.

   TRANSLATOR / COMMUNITY NOTES:
   - Every visible English string can get a translation + audio.
     Foods: add "fa" (Dari) and/or "ps" (Pashto) to a food, e.g.
        {e:"🫓", n:"Naan", p:10, fa:"نان", ps:"ډوډۍ", audio:"naan_fa.mp3"}
     Swaps/stories/tips: add "_fa"/"_ps" companions to from/to/why/h/b, e.g.
        {from:"Sweet chai", from_fa:"چای شیرین", ...}
   - "dir":"rtl" flips text direction once native strings are filled in.
   - "audio" values are filenames the community records (drop in /audio/).
   - These starter strings are a SCAFFOLD to be validated by each
     community's bicultural workers / translators.
   ============================================================ */
window.RFR_PACKS = {

  /* ---------------- Afghan (Dari / Pashto) ---------------- */
  af: {
    label:"Afghan", flag:"🇦🇫", lang:"fa", dir:"rtl", accent:"#2f7a3a",
    native:"دری · پښتو", nativeRtl:true,
    greet:{ text:"السلام علیکم", rtl:true, translit:"As-salamu alaykum · Khosh âmadid" },
    msg:"Your food, your way — with gentle tips for lighter chai, bread and rice.",

    /* scanner / log foods — staples of the Afghan kitchen */
    foods:[
      {e:"🫓", n:"Naan", p:10, fa:"نان"},
      {e:"🍚", n:"Palaw", p:12, fa:"پلو"},
      {e:"🥬", n:"Sabzi (spinach)", p:15, fa:"سبزی"},
      {e:"🫘", n:"Lubia (beans)", p:15, fa:"لوبیا"},
      {e:"🥛", n:"Mast (yogurt)", p:10, fa:"ماست"},
      {e:"🥒", n:"Bandari (salad)", p:10, fa:"سالاد"},
      {e:"🥕", n:"Zardak (carrot)", p:10, fa:"زردک"},
      {e:"🫖", n:"Green tea", p:5, fa:"چای سبز"},
      {e:"🌴", n:"Khurma (dates)", p:10, fa:"خرما"},
      {e:"🥚", n:"Tokhm (eggs)", p:12, fa:"تخم"},
      {e:"🍎", n:"Seb (apple)", p:10, fa:"سیب"},
      {e:"💧", n:"Water (Aab)", p:5, fa:"آب"}
    ],

    /* Smart Swaps — keep the dish, lighten it */
    swaps:[
      {fe:"🫖", te:"🫖", from:"Sweet chai (lots of sugar)", to:"Chai with less sugar + cardamom",
       why:"Chai is part of every day — you don't have to give it up. Try using half the sugar and adding cardamom or a date for natural sweetness."},
      {fe:"🥟", te:"♨️", from:"Deep-fried bolani", to:"Baked or pan-fried bolani",
       why:"Bolani tastes just as good baked or cooked in a lightly-oiled pan — with far less oil than deep-frying."},
      {fe:"🍚", te:"🥬", from:"A big plate of white palaw", to:"More sabzi, a little less rice",
       why:"Enjoy your palaw — just add a generous side of sabzi or salad so rice isn't the whole plate."},
      {fe:"🍬", te:"🌴", from:"Sweets & halwa", to:"Khurma (dates) & fresh fruit",
       why:"Dates and fruit satisfy a sweet craving the natural way, and add fibre and minerals too."},
      {fe:"🥤", te:"🥛", from:"Sugary soft drinks", to:"Dogh (savoury yogurt drink) or water",
       why:"Dogh is refreshing and traditional, with none of the sugar of a fizzy drink."},
      {fe:"🍞", te:"🌾", from:"White naan only", to:"Wholemeal naan when you can",
       why:"Wholemeal keeps more fibre for steadier energy — a small change to a food you eat every day."}
    ],

    /* stories & tips (reuse existing illustrations by key) */
    stories:[
      {id:"af_s1", illo:"dates", h:"Grandma's dates", b:"After dinner, the family always reached for sweets. Grandma began putting out a bowl of dates and orange slices instead. Nobody missed the sweets — and everyone felt lighter."},
      {id:"af_s2", illo:"walk", h:"The evening walk", b:"After iftar and dinner, the family started a short walk together around the neighbourhood. It helped digestion, and became the moment of the day everyone looked forward to."},
      {id:"af_s3", illo:"pot", h:"Sunday's big qorma", b:"Cooking a large pot of vegetable qorma on the weekend meant there was always something healthy and home-made ready — so the family reached for takeaways far less."}
    ],
    tips:[
      {id:"af_t1", illo:"water", h:"Lighter chai", b:"Try halving the sugar in your chai and sweetening with cardamom or a single date. Your taste adjusts within a week."},
      {id:"af_t2", illo:"plate", h:"Half a plate of sabzi", b:"Make vegetables or salad half of your plate at dinner, with rice and meat as the smaller share."},
      {id:"af_t3", illo:"label", h:"Check the sugar", b:"When shopping, glance at 'sugars per 100g'. Around 5g is low; over 22.5g is high. Your scanner shows this for you."}
    ]
  },

  /* ---------------- Karen (S'gaw) ---------------- */
  kar: {
    label:"Karen (S'gaw)", flag:"🇲🇲", lang:"ksw", dir:"ltr", accent:"#1f6f8b",
    native:"S'gaw Karen", nativeRtl:false,
    greet:{ text:"Welcome", rtl:false, translit:"S'gaw Karen" },
    msg:"Celebrating fresh greens, fish and rice — with easy ideas as you settle in.",
    foods:[
      {e:"🍚", n:"Rice", p:8}, {e:"🐟", n:"Fish paste (Nga pi)", p:10},
      {e:"🥬", n:"Boiled greens", p:15}, {e:"🎋", n:"Bamboo shoots", p:12},
      {e:"🌶️", n:"Chili", p:5}, {e:"🍵", n:"Tea-leaf salad", p:10},
      {e:"🥭", n:"Papaya", p:10}, {e:"🥒", n:"Mustard leaf", p:12},
      {e:"🫘", n:"Beans", p:15}, {e:"💧", n:"Water", p:5}
    ],
    swaps:[
      {fe:"🥤", te:"💧", from:"Sugary drinks (new here)", to:"Water or plain tea",
       why:"Fizzy and energy drinks are cheap and everywhere now — but water and tea keep the sugar out and cost nothing."},
      {fe:"🍚", te:"🥬", from:"A very large bowl of white rice", to:"A little less rice, more greens",
       why:"Your greens and fish are wonderful — just let rice be the smaller part of the bowl."},
      {fe:"🍟", te:"🍵", from:"Fast food / fried snacks", to:"Traditional boiled or steamed dishes",
       why:"Your home cooking — boiled greens, fish, herbs — is healthier than most takeaways. Keep it going."}
    ],
    stories:[
      {id:"kar_s1", illo:"pot", h:"Keeping our kitchen", b:"When the family arrived, cheap fast food was everywhere. They decided to keep cooking the greens, fish and rice they knew — and felt better for it."},
      {id:"kar_s2", illo:"walk", h:"Walking together", b:"An evening walk became a way for the family to stay close and healthy in a new place."}
    ],
    tips:[
      {id:"kar_t1", illo:"plate", h:"Keep your greens", b:"Your traditional greens and herbs are some of the healthiest food there is. Keep them at the centre of the plate."},
      {id:"kar_t2", illo:"water", h:"Water over soft drinks", b:"Sugary drinks are new and everywhere. Water and plain tea keep you well and save money."}
    ]
  },

  /* ---------------- Punjabi ---------------- */
  pa: {
    label:"Punjabi", flag:"🇮🇳", lang:"pa", dir:"ltr", accent:"#d9822b",
    native:"ਪੰਜਾਬੀ", nativeRtl:false,
    greet:{ text:"ਸਤ ਸ੍ਰੀ ਅਕਾਲ", rtl:false, translit:"Sat Sri Akal · Jee aayaan nu" },
    msg:"Roti, dal and saag at the centre — with lighter takes on chai, ghee and mithai.",
    foods:[
      {e:"🫓", n:"Roti", p:10, pa:"ਰੋਟੀ"}, {e:"🍲", n:"Dal", p:15, pa:"ਦਾਲ"},
      {e:"🥬", n:"Saag", p:15, pa:"ਸਾਗ"}, {e:"🧀", n:"Paneer", p:12, pa:"ਪਨੀਰ"},
      {e:"🫘", n:"Rajma", p:15, pa:"ਰਾਜਮਾ"}, {e:"🥛", n:"Dahi (yogurt)", p:10, pa:"ਦਹੀਂ"},
      {e:"🥕", n:"Gajar (carrot)", p:10, pa:"ਗਾਜਰ"}, {e:"🫖", n:"Chai", p:5, pa:"ਚਾਹ"},
      {e:"🍎", n:"Fruit", p:10}, {e:"💧", n:"Water", p:5, pa:"ਪਾਣੀ"}
    ],
    swaps:[
      {fe:"🫖", te:"🫖", from:"Sweet chai", to:"Chai with less sugar",
       why:"A cup or two of sweet chai a day adds up fast. Slowly reduce the sugar — your taste adjusts within a week."},
      {fe:"🥛", te:"🥛", from:"Sweet lassi", to:"Salty or plain lassi",
       why:"A salted or plain lassi is just as refreshing with none of the added sugar."},
      {fe:"🍬", te:"🌴", from:"Mithai (sweets)", to:"Fruit or dates",
       why:"Save mithai for festivals. On ordinary days, fruit or dates satisfy the sweet tooth."},
      {fe:"🍟", te:"♨️", from:"Fried samosa / pakora", to:"Baked or air-fried",
       why:"Baking or air-frying gives you the crunch with a fraction of the oil."},
      {fe:"🍯", te:"🥄", from:"Lots of ghee", to:"A lighter hand with ghee",
       why:"Ghee is delicious — just a little less goes a long way, and your dishes still taste like home."}
    ],
    stories:[
      {id:"pa_s1", illo:"dates", h:"Sweets for festivals", b:"The family loved their mithai — but every day added up. They kept it for festivals and reached for fruit in between, and felt the difference."},
      {id:"pa_s2", illo:"pot", h:"Dal and saag", b:"Leaning on dal, saag and roti — the heart of Punjabi cooking — kept the family full, healthy and close to home."}
    ],
    tips:[
      {id:"pa_t1", illo:"water", h:"Less sugar in chai", b:"Reduce the sugar in your chai one small step at a time. Within a week it tastes normal — and the savings add up."},
      {id:"pa_t2", illo:"plate", h:"Dal, saag, roti", b:"Your everyday foods — dal, saag, yogurt, wholemeal roti — are genuinely healthy. Keep them at the centre."}
    ]
  },

  /* ---------------- English / Other (uses each page's defaults) ---------------- */
  en: {
    label:"English / Other", flag:"🌐", lang:"en", dir:"ltr", accent:"#2f9e44",
    native:"English", nativeRtl:false,
    greet:{ text:"Welcome", rtl:false, translit:"" },
    msg:"A healthy-eating companion — scan foods, earn rewards and learn as you go."
    /* no foods/swaps/stories → pages fall back to their built-in defaults */
  }
};

/* helper: current pack (or null) + language */
window.RFR_pack = function(){
  try{ var c=localStorage.getItem("rfr_culture"); return (c && window.RFR_PACKS[c]) || null; }catch(e){ return null; }
};
window.RFR_lang = function(){ try{ return localStorage.getItem("rfr_lang")||"en"; }catch(e){ return "en"; } };
