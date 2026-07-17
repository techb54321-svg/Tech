/* ============================================================
   Real Food Rewards, culture content packs
   ------------------------------------------------------------
   ONE place to edit per-community content. All pages read this.

   FOR TRANSLATORS / COMMUNITY WORKERS:
   - Every English string can get a translation and audio.
     Foods: add "fa" (Dari) or "ps" (Pashto), for example
        {e:"\u{1FAD3}", n:"Naan", p:10, fa:"نان", ps:"ډوډۍ", audio:"naan_fa.mp3"}
     Swaps, stories, tips, quiz: add "_fa" or "_ps" companions to the
     text fields (from, to, why, h, b, q), for example
        {from:"Sweet chai", from_fa:"...", ...}
   - "dir":"rtl" flips the whole layout once the native text is filled in.
   - "audio" holds filenames the community records (drop them in /audio/).
   - These starter words are a friendly draft to be checked with each
     community's own people before it goes live.
   ============================================================ */
window.RFR_PACKS = {

  /* ---------------- Afghan (Dari / Pashto) ---------------- */
  af: {
    label:"Afghan", flag:"\u{1F1E6}\u{1F1EB}", lang:"fa", dir:"rtl", accent:"#2f7a3a",
    native:"دری · پښتو", nativeRtl:true,
    greet:{ text:"السلام علیکم", rtl:true, translit:"As-salamu alaykum · Khosh âmadid" },
    msg:"Your food, your way, with gentle ideas for lighter chai, warm bread and good rice.",

    foods:[
      {e:"\u{1FAD3}", n:"Naan", p:10, fa:"نان"},
      {e:"\u{1F35A}", n:"Palaw", p:12, fa:"پلو"},
      {e:"\u{1F96C}", n:"Sabzi (spinach)", p:15, fa:"سبزی"},
      {e:"\u{1FAD8}", n:"Lubia (beans)", p:15, fa:"لوبیا"},
      {e:"\u{1F95B}", n:"Mast (yogurt)", p:10, fa:"ماست"},
      {e:"\u{1F952}", n:"Bandari (salad)", p:10, fa:"سالاد"},
      {e:"\u{1F955}", n:"Zardak (carrot)", p:10, fa:"زردک"},
      {e:"\u{1FAD6}", n:"Green tea", p:5, fa:"چای سبز"},
      {e:"\u{1F334}", n:"Khurma (dates)", p:10, fa:"خرما"},
      {e:"\u{1F95A}", n:"Tokhm (eggs)", p:12, fa:"تخم"},
      {e:"\u{1F34E}", n:"Seb (apple)", p:10, fa:"سیب"},
      {e:"\u{1F4A7}", n:"Water (Aab)", p:5, fa:"آب"}
    ],

    swaps:[
      {fe:"\u{1FAD6}", te:"\u{1FAD6}", from:"Sweet chai with lots of sugar", to:"Chai with a little less sugar and cardamom",
       why:"Chai is part of every day, and you get to keep it. Just use a little less sugar, and let cardamom or a date bring the sweetness."},
      {fe:"\u{1F95F}", te:"♨️", from:"Deep fried bolani", to:"Baked or pan cooked bolani",
       why:"Bolani tastes just as lovely baked, or cooked in a pan with a little oil. Still golden, and much kinder to your body."},
      {fe:"\u{1F35A}", te:"\u{1F96C}", from:"A big plate of white palaw", to:"A little less rice, more sabzi",
       why:"Enjoy your palaw. Pop a good helping of sabzi or salad beside it, so the rice is not the whole plate."},
      {fe:"\u{1F36C}", te:"\u{1F334}", from:"Sweets and halwa", to:"Khurma (dates) and fresh fruit",
       why:"Dates and fruit are sweet in a gentle way, and they give your body something good too. A lovely end to a meal."},
      {fe:"\u{1F964}", te:"\u{1F95B}", from:"Sugary soft drinks", to:"Dogh (savoury yogurt drink) or water",
       why:"Dogh is cooling and full of goodness, with none of the sugar of a fizzy drink. An old friend that loves you back."},
      {fe:"\u{1F35E}", te:"\u{1F33E}", from:"Only white naan", to:"Wholemeal naan when you can",
       why:"When you can, reach for wholemeal naan. It keeps you fuller for longer, and it is a small change to the bread you already love."}
    ],

    stories:[
      {id:"af_s1", motif:"🌴", hue:"peach", photo:"https://loremflickr.com/640/400/dates,fruit?lock=201",
       h:"The bowl of dates", by:"Bibi Fariba's story",
       dek:"After every dinner, the same little ritual. Until Bibi quietly changed it.",
       b:["In Bibi Fariba's house, dinner never truly ended. The plates were cleared, the chai was poured, and then, as sure as the evening itself, the children would drift toward the cupboard where the sweets were kept.",
          "She had done the same as a girl. But lately she watched her grandchildren, sticky fingered and restless long past bedtime, and something tugged at her. She thought of her own mother, who always kept a bowl of dates on the sofreh, plump and dark and sweet as honey.",
          "So one evening, without a word, Bibi set out a bowl of dates and a plate of orange slices where the sweets used to sit. Little Zohal eyed them with suspicion. Then she took one, and then another, and soon the whole bowl had disappeared.",
          "Now the children ask for dates before they ask for sweets. They settle sooner, and Bibi rests easier, knowing she has passed something down. 'It is a small thing,' she says, 'but small things, repeated, become who we are.'"],
       pull:"Small things, repeated, become who we are."},
      {id:"af_s2", motif:"🌇", hue:"rose", photo:"https://loremflickr.com/640/400/park,sunset?lock=202",
       h:"Rahim's fifteen minutes", by:"Rahim's story",
       dek:"He was too tired to move after dinner. His wife had an idea.",
       b:["By the time dinner was finished, Rahim wanted only to sink onto the toshak and not move until morning. The day sat heavy on him, and the food sat heavy too.",
          "His wife, Soraya, watched him one evening and said simply, 'Come. Just to the end of the street and back. Fifteen minutes.' He grumbled, but he went. The children, hearing there was a walk, came running.",
          "The air was cool and kind. They passed the baker pulling down his shutter and the neighbour watering her herbs on the step. The little ones raced ahead and circled back, breathless and laughing, and Rahim felt his chest open, just a little.",
          "They walk most evenings now, the whole family together, fifteen minutes into the blue of the dusk. His chai sits lighter afterward, and his sleep runs deeper. But that is not the reason they go. They go because it has become the part of the day that belongs to them."],
       pull:"It has become the part of the day that belongs to them."},
      {id:"af_s3", motif:"🍲", hue:"green", photo:"https://loremflickr.com/640/400/pilaf,rice?lock=203",
       h:"The Sunday pot", by:"Nadia's story",
       dek:"One big pot on the weekend, and the whole week felt lighter.",
       b:["The week had a way of getting away from Nadia. Between the children, the errands and the long tired days, dinner often arrived as whatever was quickest, a call to the takeaway, a bag of something fried.",
          "One Sunday, with the kitchen quiet and the morning wide open, she set a great pot on the stove and made vegetable palaw the way her mother had taught her, the rice fragrant with cumin, sweet with carrot and raisin.",
          "The smell wandered through the house and drew the children in one by one. There was enough for Sunday, and plenty left over besides. On Monday, tired and late, she opened the fridge and there it was, waiting for her.",
          "That single pot carried them halfway through the week, and slowly the takeaways grew rare. 'One big pot on the weekend,' Nadia says, laughing, 'and somehow the whole week feels easier.'"],
       pull:"One big pot on the weekend, and somehow the whole week feels easier."}
    ],
    tips:[
      {id:"af_t1", illo:"chai", h:"Lighter chai", b:"Try a little less sugar in your chai, with a pinch of cardamom instead. In a week your taste settles, and the chai still feels like home."},
      {id:"af_t2", illo:"dates", h:"Dates after dinner", b:"When the sweets are calling after dinner, set out a bowl of dates and orange slices instead. Sweet and satisfying, and gentle on you."},
      {id:"af_t3", illo:"walk", h:"A short evening walk", b:"A fifteen minute walk after dinner helps the meal settle, and it is a warm moment for the whole family. Your chai will sit lighter for it."},
      {id:"af_t4", illo:"plate", h:"Half a plate of sabzi", b:"Let vegetables or salad fill half your plate at dinner, with rice and meat sharing the rest. Simple, and it does you good."},
      {id:"af_t5", illo:"naan", h:"Warm wholemeal naan", b:"Naan is the heart of the table. When you can, choose the wholemeal kind, and enjoy it fresh and warm with your meal."},
      {id:"af_t6", illo:"water", h:"Dogh or water", b:"Instead of a sugary fizzy drink, pour a glass of dogh or cool water. Refreshing, traditional, and none of the sugar."}
    ],

    quiz:[
      {q:"Which drink has the least sugar?", a:["Sweet chai","Green tea with no sugar","A fizzy drink","Packaged juice"], c:1},
      {q:"A lighter way to enjoy bolani is to...", a:["Deep fry it for longer","Add more oil","Bake it or cook it in a pan","Leave out the vegetables"], c:2},
      {q:"A gentle sweet after dinner could be...", a:["Dates and fresh fruit","More halwa","A fizzy drink","Sweet biscuits"], c:0},
      {q:"To balance a plate of palaw, add...", a:["More rice","Extra oil","A sugary drink","A good helping of sabzi or salad"], c:3},
      {q:"Dogh is a traditional drink made from...", a:["Cola and sugar","Yogurt","Cream and syrup","Energy powder"], c:1},
      {q:"Wholemeal naan gives you more...", a:["Fibre, to keep you full","Sugar","Salt","Oil"], c:0},
      {q:"A caring way to break your fast in Ramadan is with...", a:["Only fried snacks","Fizzy drinks","Dates and water","A plate of sweets"], c:2},
      {q:"How much of your plate is a good aim for vegetables?", a:["None","About half","A tiny bit","All meat"], c:1}
    ]
  },

  /* ---------------- Karen (S'gaw) ---------------- */
  kar: {
    label:"Karen (S'gaw)", flag:"\u{1F1F2}\u{1F1F2}", lang:"ksw", dir:"ltr", accent:"#1f6f8b",
    native:"S'gaw Karen", nativeRtl:false,
    greet:{ text:"Welcome", rtl:false, translit:"S'gaw Karen" },
    msg:"Celebrating fresh greens, fish and rice, with easy ideas for settling into a new home.",
    foods:[
      {e:"\u{1F35A}", n:"Rice", p:8}, {e:"\u{1F41F}", n:"Fish paste (Nga pi)", p:10},
      {e:"\u{1F96C}", n:"Boiled greens", p:15}, {e:"\u{1F38B}", n:"Bamboo shoots", p:12},
      {e:"\u{1F336}️", n:"Chili", p:5}, {e:"\u{1F375}", n:"Tea leaf salad", p:10},
      {e:"\u{1F96D}", n:"Papaya", p:10}, {e:"\u{1F952}", n:"Mustard leaf", p:12},
      {e:"\u{1FAD8}", n:"Beans", p:15}, {e:"\u{1F4A7}", n:"Water", p:5}
    ],
    swaps:[
      {fe:"\u{1F964}", te:"\u{1F4A7}", from:"Sugary drinks, new here", to:"Water or plain tea",
       why:"Fizzy and energy drinks are cheap and everywhere now. Water and plain tea keep the sugar out, and they cost nothing at all."},
      {fe:"\u{1F35A}", te:"\u{1F96C}", from:"A very large bowl of white rice", to:"A little less rice, more greens",
       why:"Your greens and fish are wonderful. Just let rice be the smaller part of the bowl, with plenty of greens beside it."},
      {fe:"\u{1F35F}", te:"\u{1F375}", from:"Fast food and fried snacks", to:"Your own boiled and steamed dishes",
       why:"Your home cooking, the greens and fish and herbs, is kinder than most takeaway. It is worth holding onto."}
    ],
    stories:[
      {id:"kar_s1", illo:"pot", h:"Keeping our kitchen", b:"When the family first arrived, cheap fast food was everywhere. They chose to keep cooking the greens, fish and rice they knew, and they felt better for it."},
      {id:"kar_s2", illo:"walk", h:"Walking together", b:"An evening walk became a gentle way for the family to stay close, and to feel well in a brand new place."}
    ],
    tips:[
      {id:"kar_t1", illo:"plate", h:"Keep your greens", b:"Your traditional greens and herbs are some of the healthiest food there is. Keep them right at the centre of the plate."},
      {id:"kar_t2", illo:"water", h:"Water over soft drinks", b:"Sugary drinks are new and everywhere. Water and plain tea keep you well, and they are gentle on the purse too."}
    ]
  },

  /* ---------------- Punjabi ---------------- */
  pa: {
    label:"Punjabi", flag:"\u{1F1EE}\u{1F1F3}", lang:"pa", dir:"ltr", accent:"#d9822b",
    native:"ਪੰਜਾਬੀ", nativeRtl:false,
    greet:{ text:"ਸਤ ਸ੍ਰੀ ਅਕਾਲ", rtl:false, translit:"Sat Sri Akal · Jee aayaan nu" },
    msg:"Roti, dal and saag at the centre, with lighter takes on chai, ghee and mithai.",
    foods:[
      {e:"\u{1FAD3}", n:"Roti", p:10, pa:"ਰੋਟੀ"}, {e:"\u{1F372}", n:"Dal", p:15, pa:"ਦਾਲ"},
      {e:"\u{1F96C}", n:"Saag", p:15, pa:"ਸਾਗ"}, {e:"\u{1F9C0}", n:"Paneer", p:12, pa:"ਪਨੀਰ"},
      {e:"\u{1FAD8}", n:"Rajma", p:15, pa:"ਰਾਜਮਾ"}, {e:"\u{1F95B}", n:"Dahi (yogurt)", p:10, pa:"ਦਹੀਂ"},
      {e:"\u{1F955}", n:"Gajar (carrot)", p:10, pa:"ਗਾਜਰ"}, {e:"\u{1FAD6}", n:"Chai", p:5, pa:"ਚਾਹ"},
      {e:"\u{1F34E}", n:"Fruit", p:10}, {e:"\u{1F4A7}", n:"Water", p:5, pa:"ਪਾਣੀ"}
    ],
    swaps:[
      {fe:"\u{1FAD6}", te:"\u{1FAD6}", from:"Sweet chai", to:"Chai with a little less sugar",
       why:"A cup or two of sweet chai a day adds up fast. Bring the sugar down slowly, and within a week your taste will settle."},
      {fe:"\u{1F95B}", te:"\u{1F95B}", from:"Sweet lassi", to:"Salty or plain lassi",
       why:"A salted or plain lassi is just as cooling and refreshing, with none of the added sugar."},
      {fe:"\u{1F36C}", te:"\u{1F334}", from:"Mithai (sweets)", to:"Fruit or dates",
       why:"Save mithai for festivals and happy days. In between, fruit or dates settle the sweet tooth just fine."},
      {fe:"\u{1F35F}", te:"♨️", from:"Fried samosa and pakora", to:"Baked or air cooked",
       why:"Baking or air cooking gives you that lovely crunch with only a little of the oil."},
      {fe:"\u{1F36F}", te:"\u{1F944}", from:"Lots of ghee", to:"A lighter hand with ghee",
       why:"Ghee is delicious, and a little goes a long way. Your dishes will still taste like home."}
    ],
    stories:[
      {id:"pa_s1", illo:"dates", h:"Sweets for festivals", b:"The family loved their mithai, but every day it added up. They kept it for festivals and reached for fruit in between, and they felt the difference."},
      {id:"pa_s2", illo:"pot", h:"Dal and saag", b:"Leaning on dal, saag and roti, the heart of Punjabi cooking, kept the family full, well and close to home."}
    ],
    tips:[
      {id:"pa_t1", illo:"water", h:"Less sugar in chai", b:"Bring the sugar in your chai down one small step at a time. Within a week it tastes just right, and the savings add up too."},
      {id:"pa_t2", illo:"plate", h:"Dal, saag, roti", b:"Your everyday foods, dal, saag, yogurt and wholemeal roti, are genuinely good for you. Keep them at the centre."}
    ]
  },

  /* ---------------- English / Other (falls back to each page's defaults) ---------------- */
  en: {
    label:"English / Other", flag:"\u{1F310}", lang:"en", dir:"ltr", accent:"#2f9e44",
    native:"English", nativeRtl:false,
    greet:{ text:"Welcome", rtl:false, translit:"" },
    msg:"A friendly healthy eating companion. Scan foods, earn rewards and learn as you go."
  }
};

/* helpers */
window.RFR_pack = function(){
  try{ var c=localStorage.getItem("rfr_culture"); return (c && window.RFR_PACKS[c]) || null; }catch(e){ return null; }
};
window.RFR_lang = function(){ try{ return localStorage.getItem("rfr_lang")||"en"; }catch(e){ return "en"; } };
