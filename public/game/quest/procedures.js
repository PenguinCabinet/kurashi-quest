export default {
  "$comment": "引越しクエスト 手続きデータ。TODO画面では steps / stuckIf を使わないが、後からシミュレーションを足すとき作り直さないよう最初から入れておく。verified:false は未確認。対象自治体が決まったら確認して true にする。",
  "dataVersion": "2026-07-30",
  "targetCity": "渋谷区",
  "procedures": [
    {
      "id": "tenshutsu-todoke",
      "phase": "before",
      "order": 1,
      "officialName": "転出届",
      "displayName": "転出届を出す",
      "what": "前に住んでいた市に、出ていくことを届け出る",
      "ifNot": "転入届が出せない。住民票が前の市に残ったままになる",
      "littleKnown": true,
      "littleKnownReason": "実家を出た学生は出していないことが多い",
      "deadline": {
        "kind": "aroundMove",
        "days": 14,
        "label": "引越しの前後14日以内"
      },
      "requires": [],
      "where": {
        "text": "前に住んでいた市役所の市民課",
        "placeKey": "prev-city-hall",
        "verified": false,
        "todo": "前に住んでいた自治体の窓口。マイナポータルの引越しワンストップならオンラインで出せる"
      },
      "sayThis": {
        "text": "転出届を出したいです",
        "verified": false
      },
      "minutes": {
        "value": 15,
        "verified": false
      },
      "result": "マイナンバーカードが無い人は転出証明書をもらう",
      "bring": [
        {
          "id": "id-doc",
          "label": "本人確認書類",
          "verified": true,
          "category": "home"
        },
        {
          "id": "mynumber-card",
          "label": "マイナンバーカード",
          "note": "持っていればマイナポータルからでも出せる",
          "verified": true,
          "category": "home"
        }
      ],
      "showIf": {
        "always": true
      },
      "skipIf": null,
      "steps": [
        {
          "n": 1,
          "text": "市役所に行く。または マイナポータルから出す"
        },
        {
          "n": 2,
          "text": "番号札を取る"
        },
        {
          "n": 3,
          "text": "呼ばれたら「転出届を出したいです」と言う"
        },
        {
          "n": 4,
          "text": "用紙を渡されるので書く"
        },
        {
          "n": 5,
          "text": "本人確認書類を見せる",
          "stuckIf": {
            "missing": "id-doc",
            "message": "本人確認書類が無いと、ここで止まります。運転免許証・パスポート・マイナンバーカードなどが要ります"
          }
        },
        {
          "n": 6,
          "text": "マイナンバーカードが無ければ転出証明書をもらう",
          "stuckIf": null
        }
      ],
      "sources": [
        {
          "name": "各自治体の公式サイト（前住所地）",
          "url": "",
          "fetchedAt": "",
          "verified": false
        },
        {
          "name": "渋谷区 転入届（引越しワンストップの案内あり）",
          "url": "https://www.city.shibuya.tokyo.jp/kurashi/jumin/ido/t_tennyu.html",
          "fetchedAt": "2026-07-30",
          "verified": true
        }
      ]
    },
    {
      "id": "lifeline",
      "phase": "before",
      "order": 2,
      "officialName": "電気・ガス・水道の住所変更",
      "displayName": "電気・ガス・水道を止めて、新居で開ける",
      "what": "前の家の契約を止めて、新しい家で使えるようにする",
      "ifNot": "引越し当日に電気や水が使えない",
      "littleKnown": false,
      "deadline": {
        "kind": "beforeMove",
        "days": 7,
        "label": "引越しの1週間前まで"
      },
      "requires": [],
      "where": {
        "text": "各社のWebサイトか電話",
        "placeKey": "online",
        "verified": true
      },
      "sayThis": {
        "text": "引越すので、住所変更をお願いします",
        "verified": false
      },
      "minutes": {
        "value": 30,
        "verified": false
      },
      "result": "当日から新居で使える",
      "bring": [
        {
          "id": "contract-number",
          "label": "お客様番号（検針票や請求書に載っている）",
          "verified": false,
          "category": "home"
        }
      ],
      "showIf": {
        "always": true
      },
      "skipIf": null,
      "steps": [
        {
          "n": 1,
          "text": "検針票か請求書で、お客様番号を調べる"
        },
        {
          "n": 2,
          "text": "各社のサイトから引越し手続きを選ぶ"
        },
        {
          "n": 3,
          "text": "停止する日と、開始する日を入れる"
        },
        {
          "n": 4,
          "text": "ガスだけは開栓の立ち会いが要ることがある",
          "stuckIf": null
        }
      ],
      "sources": [
        {
          "name": "各社の公式サイト",
          "url": "",
          "fetchedAt": "",
          "verified": false
        }
      ]
    },
    {
      "id": "yubin-tenso",
      "phase": "before",
      "order": 3,
      "officialName": "転居届（郵便物の転送）",
      "displayName": "郵便の転送届を出す",
      "what": "前の住所に届く郵便を、1年間、新住所に転送してもらう",
      "ifNot": "大事な書類が前の住所に届き続ける",
      "littleKnown": true,
      "littleKnownReason": "無料でできることを知らない人が多い",
      "deadline": {
        "kind": "aroundMove",
        "label": "引越しの前後。早いほどよい"
      },
      "requires": [],
      "where": {
        "text": "郵便局の窓口。ポスト投函、e転居（Web・郵便局アプリ）でも出せる",
        "placeKey": "post-office",
        "verified": true
      },
      "sayThis": {
        "text": "転居届を出したいです",
        "verified": false
      },
      "minutes": {
        "value": 10,
        "verified": false
      },
      "result": "届出日から1年間、新住所に転送される",
      "bring": [
        {
          "id": "id-doc",
          "label": "本人確認書類",
          "verified": true,
          "category": "home",
          "note": "運転免許証、健康保険証の資格確認書など"
        },
        {
          "id": "old-address-proof",
          "label": "旧住所が確認できるもの",
          "verified": false,
          "category": "home",
          "note": "旧住所が書かれた免許証など。日本郵便のページに明記がないため、念のため"
        }
      ],
      "showIf": {
        "always": true
      },
      "skipIf": null,
      "steps": [
        {
          "n": 1,
          "text": "郵便局に行く。またはe転居のサイトを開く"
        },
        {
          "n": 2,
          "text": "転居届の用紙をもらって書く"
        },
        {
          "n": 3,
          "text": "本人確認書類を見せる",
          "stuckIf": {
            "missing": "id-doc",
            "message": "本人確認書類が無いと、ここで止まります。窓口では必ず見せることになります"
          }
        },
        {
          "n": 4,
          "text": "転送は1年間。切れる前にもう一度出す必要がある",
          "stuckIf": null
        }
      ],
      "sources": [
        {
          "name": "日本郵便 転居・転送サービス",
          "url": "https://www.post.japanpost.jp/service/receive/relocation/",
          "fetchedAt": "2026-07-31",
          "verified": true
        }
      ]
    },
    {
      "id": "tennyu-todoke",
      "phase": "within14",
      "order": 1,
      "officialName": "転入届",
      "displayName": "転入届を出す",
      "what": "住民票をこの市に移す",
      "ifNot": "14日を過ぎると過料の対象になる。下の手続きも全部できない",
      "littleKnown": false,
      "deadline": {
        "kind": "afterMove",
        "days": 14,
        "label": "引越しから14日以内"
      },
      "requires": [
        "tenshutsu-todoke"
      ],
      "where": {
        "text": "渋谷区役所 本庁舎3階 住民戸籍課 住民登録係",
        "placeKey": "city-hall",
        "hours": "平日 8:30〜17:00",
        "verified": true
      },
      "sayThis": {
        "text": "転入届を出したいです",
        "verified": false,
        "todo": "実際に窓口で通じるか確認"
      },
      "minutes": {
        "value": 15,
        "verified": false
      },
      "result": "住民票がこの市に移る",
      "bring": [
        {
          "id": "id-doc",
          "label": "本人確認書類",
          "verified": true,
          "category": "home"
        },
        {
          "id": "mynumber-card",
          "label": "マイナンバーカード",
          "note": "転入届にも使う",
          "verified": true,
          "showIf": {
            "hasMyNumberCard": true
          },
          "category": "home"
        },
        {
          "id": "juki-pin",
          "label": "住民基本台帳用暗証番号（数字4桁）",
          "note": "カードを作ったときに決めた番号。物ではないので忘れがち",
          "physical": false,
          "verified": true,
          "showIf": {
            "hasMyNumberCard": true
          },
          "category": "home"
        },
        {
          "id": "tenshutsu-shomeisho",
          "label": "転出証明書",
          "note": "マイナポータルの引越しワンストップを使った場合は交付されない（転入届の特例）",
          "verified": true,
          "showIf": {
            "hasMyNumberCard": false
          },
          "category": "cityOffice",
          "cost": {
            "yen": 0,
            "days": 1,
            "verified": false
          },
          "todo": "「カードを持っているか」ではなく「特例転出を使ったか」で決まる。聞き方を調べる人と相談する"
        }
      ],
      "showIf": {
        "always": true
      },
      "skipIf": null,
      "steps": [
        {
          "n": 1,
          "text": "市役所に行って、番号札を取る"
        },
        {
          "n": 2,
          "text": "呼ばれたら窓口へ"
        },
        {
          "n": 3,
          "text": "「転入届を出したいです」と言う"
        },
        {
          "n": 4,
          "text": "用紙を渡されるので書く"
        },
        {
          "n": 5,
          "text": "マイナンバーカードを出して、4桁の暗証番号を入れる",
          "stuckIf": {
            "missing": "juki-pin",
            "message": "暗証番号が分からないと、ここで止まります。窓口で再設定できる場合もありますが、時間がかかります"
          }
        },
        {
          "n": 6,
          "text": "完了。住民票が移る"
        }
      ],
      "sources": [
        {
          "name": "渋谷区 転入届（区外から渋谷区へ）",
          "url": "https://www.city.shibuya.tokyo.jp/kurashi/jumin/ido/t_tennyu.html",
          "fetchedAt": "2026-07-30",
          "verified": true
        },
        {
          "name": "渋谷区役所 本庁舎案内・フロアマップ",
          "url": "https://www.city.shibuya.tokyo.jp/shisetsu/kuyakusho/kuyakusho/shintyousha.html",
          "fetchedAt": "2026-07-30",
          "verified": true
        }
      ]
    },
    {
      "id": "mynumber-address",
      "phase": "within14",
      "order": 2,
      "officialName": "個人番号カードの券面記載事項変更（継続利用手続き）",
      "displayName": "マイナンバーカードの住所を書き換える",
      "what": "カードに書いてある住所を、新しい住所に直す",
      "ifNot": "転入届をした日から90日を過ぎると、カードが失効して作り直しになる",
      "littleKnown": true,
      "littleKnownReason": "失効することを知らない人が多い",
      "deadline": {
        "kind": "afterProcedure",
        "afterId": "tennyu-todoke",
        "days": 90,
        "label": "転入届をした日から90日以内"
      },
      "requires": [
        "tennyu-todoke"
      ],
      "where": {
        "text": "渋谷区役所 本庁舎3階 住民戸籍課（転入届と同じ窓口）",
        "placeKey": "city-hall",
        "hours": "平日 8:30〜17:00",
        "verified": true
      },
      "sayThis": {
        "text": "マイナンバーカードの住所も変更したいです",
        "verified": false
      },
      "minutes": {
        "value": 10,
        "verified": false
      },
      "result": "カードの裏面に新しい住所が書かれる",
      "bring": [
        {
          "id": "mynumber-card",
          "label": "マイナンバーカード",
          "verified": true,
          "category": "home"
        },
        {
          "id": "juki-pin",
          "label": "住民基本台帳用暗証番号（数字4桁）",
          "note": "転入届と同じ番号",
          "physical": false,
          "verified": true,
          "category": "home"
        }
      ],
      "showIf": {
        "hasMyNumberCard": true
      },
      "skipIf": {
        "hasMyNumberCard": false,
        "message": "マイナンバーカードを持っていないので、あなたは要りません"
      },
      "steps": [
        {
          "n": 1,
          "text": "転入届と同じ日に、そのまま続けてお願いする"
        },
        {
          "n": 2,
          "text": "「マイナンバーカードの住所も変更したいです」と言う"
        },
        {
          "n": 3,
          "text": "4桁の暗証番号を入れる",
          "stuckIf": {
            "missing": "juki-pin",
            "message": "暗証番号が分からないとここで止まります"
          }
        },
        {
          "n": 4,
          "text": "カードの裏面に新住所が書かれて完了"
        }
      ],
      "sources": [
        {
          "name": "渋谷区役所 本庁舎案内・フロアマップ（マイナンバーカード関連は住民戸籍課）",
          "url": "https://www.city.shibuya.tokyo.jp/shisetsu/kuyakusho/kuyakusho/shintyousha.html",
          "fetchedAt": "2026-07-30",
          "verified": true
        },
        {
          "name": "大田区 住所変更に伴うマイナンバーカードの手続き（90日の根拠）",
          "url": "https://www.city.ota.tokyo.jp/seikatsu/koseki_j/jyuminhyo/todokede/jyuusyo-henkou_mynumber-card.html",
          "fetchedAt": "2026-07-26",
          "verified": true
        }
      ]
    },
    {
      "id": "gakusei-nofu-tokurei",
      "phase": "within14",
      "order": 3,
      "officialName": "国民年金保険料学生納付特例申請",
      "displayName": "国民年金の学生納付特例を出す",
      "what": "20歳以上の学生が、年金の保険料を待ってもらう手続き",
      "ifNot": "未納になる。事故や病気で障害が残ったとき、障害年金を受け取れない場合がある",
      "littleKnown": true,
      "littleKnownReason": "引越しで案内が届かなくなり、そのまま未納になる人がいる",
      "deadline": {
        "kind": "anytime",
        "label": "いつでも。ただし年度ごとに毎年出す必要がある"
      },
      "requires": [
        "tennyu-todoke"
      ],
      "where": {
        "text": "渋谷区役所 本庁舎3階 国民健康保険課 国民年金係",
        "placeKey": "city-hall",
        "hours": "平日 8:30〜17:00",
        "notHere": "出張所・区民サービスセンター（ヒカリエ8階など）では手続きできません",
        "verified": true
      },
      "sayThis": {
        "text": "学生納付特例を申請したいです",
        "verified": false,
        "todo": "実際に窓口で通じるか確認"
      },
      "minutes": {
        "value": 10,
        "verified": false
      },
      "result": "申請書の控えをもらう。結果は後日、郵送で届く",
      "bring": [
        {
          "id": "student-id-copy",
          "label": "学生証の写し（両面）",
          "verified": true,
          "category": "home",
          "note": "コピーするだけ。家でできる"
        },
        {
          "id": "pension-number",
          "label": "マイナンバーカード（または基礎年金番号通知書）",
          "note": "年金の窓口では、基礎年金番号通知書でも代わりになります",
          "sameAs": "mynumber-card",
          "verified": true,
          "category": "home"
        },
        {
          "id": "id-doc",
          "label": "本人確認書類",
          "verified": true,
          "category": "home"
        },
        {
          "id": "zaigaku-shomei",
          "label": "在学証明書の原本",
          "note": "学生証の写しの代わりになる。学校で発行してもらう",
          "insteadOf": "student-id-copy",
          "category": "school",
          "cost": {
            "yen": 0,
            "days": 3,
            "verified": false
          },
          "verified": false
        }
      ],
      "showIf": {
        "occupation": "student",
        "ageAtLeast": 20
      },
      "skipIf": {
        "occupation": "worker",
        "message": "厚生年金に入っている人は要りません"
      },
      "steps": [
        {
          "n": 1,
          "text": "転入届を出したあと、国民年金の窓口へ"
        },
        {
          "n": 2,
          "text": "「学生納付特例を申請したいです」と言う"
        },
        {
          "n": 3,
          "text": "学生証の写し（両面）を出す",
          "stuckIf": {
            "missing": "student-id-copy",
            "message": "学生証の写しが無いとここで止まります。原本だけでは受け付けてもらえないことがあります"
          }
        },
        {
          "n": 4,
          "text": "申請書を書いて出す"
        },
        {
          "n": 5,
          "text": "控えをもらって完了。結果は後日、郵送で届く"
        }
      ],
      "sources": [
        {
          "name": "渋谷区 国民年金保険料の免除制度・学生納付特例",
          "url": "https://www.city.shibuya.tokyo.jp/kurashi/nenkin/shikaku-menjo/menjo.html",
          "fetchedAt": "2026-07-30",
          "verified": true
        },
        {
          "name": "渋谷区FAQ 学生納付特例の窓口と必要書類",
          "url": "https://dcp.city.shibuya.tokyo.jp/ctz/s/faq/faq-000013783",
          "fetchedAt": "2026-07-30",
          "verified": true
        },
        {
          "name": "日本年金機構 国民年金保険料の学生納付特例制度",
          "url": "https://www.nenkin.go.jp/service/kokunen/menjo/20150514.html",
          "fetchedAt": "2026-07-26",
          "verified": true
        }
      ]
    },
    {
      "id": "genki-hyoshiki",
      "phase": "within14",
      "order": 4,
      "officialName": "軽自動車税申告（報告）書兼標識交付申請",
      "displayName": "原付のナンバープレートを取り直す",
      "what": "125cc以下の原付を、渋谷区のナンバーに変える",
      "ifNot": "前の市のナンバーのままになり、軽自動車税の通知が前の住所に届く",
      "littleKnown": true,
      "littleKnownReason": "車と同じで陸運局だと思われがちですが、125cc以下は市区町村の窓口です",
      "deadline": {
        "kind": "afterMove",
        "days": 15,
        "label": "引越してから15日以内",
        "note": "渋谷区のページに日数の明記がないため、道路運送車両法の届出期間（15日）を目安にしています"
      },
      "requires": [],
      "where": {
        "text": "渋谷区役所 本庁舎6階 税務課 税務管理係",
        "placeKey": "city-hall",
        "hours": "平日 8:30〜17:00",
        "verified": true
      },
      "sayThis": {
        "text": "原付のナンバーを取りたいです",
        "verified": false,
        "todo": "実際に窓口で通じるか確認"
      },
      "minutes": {
        "value": 15,
        "verified": false
      },
      "result": "新しいナンバープレートと標識交付証明書をもらう",
      "bring": [
        {
          "id": "haisha-uketsuke",
          "label": "廃車申告受付書",
          "note": "前の市でナンバーを返してきた場合。返していないなら、前のナンバープレートと標識交付証明書を持っていく",
          "verified": true,
          "category": "home"
        },
        {
          "id": "id-doc",
          "label": "本人確認書類",
          "verified": true,
          "category": "home"
        }
      ],
      "showIf": {
        "vehicle": "moped"
      },
      "skipIf": null,
      "steps": [
        {
          "n": 1,
          "text": "渋谷区役所の6階、税務課の窓口へ行く"
        },
        {
          "n": 2,
          "text": "「原付のナンバーを取りたいです」と言う"
        },
        {
          "n": 3,
          "text": "軽自動車税申告（報告）書兼標識交付申請書を書く"
        },
        {
          "n": 4,
          "text": "廃車申告受付書を出す",
          "stuckIf": {
            "missing": "haisha-uketsuke",
            "message": "前の市でナンバーを返した証明が無いと、ここで止まります。返していない場合は、前のナンバープレートと標識交付証明書が要ります"
          }
        },
        {
          "n": 5,
          "text": "本人確認書類を見せる",
          "stuckIf": {
            "missing": "id-doc",
            "message": "本人確認書類が無いと、ここで止まります"
          }
        },
        {
          "n": 6,
          "text": "新しいナンバープレートをもらって完了"
        }
      ],
      "sources": [
        {
          "name": "渋谷区 引っ越し 原動機付自転車・ミニカーなど",
          "url": "https://www.city.shibuya.tokyo.jp/kurashi/kobai/keiji/hikkoshi_bike.html",
          "fetchedAt": "2026-07-31",
          "verified": true
        },
        {
          "name": "渋谷区 原動機付自転車の標識（ナンバープレート）の交付",
          "url": "https://www.city.shibuya.tokyo.jp/kurashi/kobai/keiji/na_ko.html",
          "fetchedAt": "2026-07-31",
          "verified": true
        }
      ]
    },
    {
      "id": "setai-henko",
      "phase": "within14",
      "order": 5,
      "officialName": "世帯変更届",
      "displayName": "世帯主を決める届を出す",
      "what": "誰が世帯主かを届け出る。家族と住み始めるときに要る",
      "ifNot": "住民票の世帯主が実際と合わなくなる。届出が遅れると過料がかかる場合がある",
      "littleKnown": true,
      "littleKnownReason": "転入届を出せば済むと思われがちですが、世帯主が変わるときは別の届が要ります",
      "deadline": {
        "kind": "afterMove",
        "days": 14,
        "label": "変更があった日から14日以内",
        "note": "届出が遅れると過料がかかる場合があります"
      },
      "requires": [
        "tennyu-todoke"
      ],
      "where": {
        "text": "渋谷区役所 本庁舎3階 住民戸籍課（転入届と同じフロア）",
        "placeKey": "city-hall",
        "hours": "平日 8:30〜17:00",
        "verified": true
      },
      "sayThis": {
        "text": "世帯変更届を出したいです",
        "verified": false,
        "todo": "実際に窓口で通じるか確認"
      },
      "minutes": {
        "value": 10,
        "verified": false
      },
      "result": "住民票の世帯主が変わる",
      "bring": [
        {
          "id": "id-doc",
          "label": "本人確認書類",
          "note": "マイナンバーカード・運転免許証・パスポートなど",
          "verified": true,
          "category": "home"
        },
        {
          "id": "kokuho-hoken",
          "label": "国民健康保険証",
          "note": "持っている人だけ",
          "verified": true,
          "category": "home"
        }
      ],
      "showIf": {
        "livingAlone": false
      },
      "skipIf": null,
      "steps": [
        {
          "n": 1,
          "text": "転入届と同じ3階の窓口で、続けてお願いする"
        },
        {
          "n": 2,
          "text": "「世帯変更届を出したいです」と言う"
        },
        {
          "n": 3,
          "text": "用紙を渡されるので書く"
        },
        {
          "n": 4,
          "text": "本人確認書類を見せる",
          "stuckIf": {
            "missing": "id-doc",
            "message": "本人確認書類が無いと、ここで止まります"
          }
        },
        {
          "n": 5,
          "text": "完了。住民票の世帯主が変わる"
        }
      ],
      "sources": [
        {
          "name": "渋谷区 世帯変更届（世帯合併・世帯分離・世帯主変更など）",
          "url": "https://www.city.shibuya.tokyo.jp/kurashi/jumin/ido/setai_henko.html",
          "fetchedAt": "2026-07-31",
          "verified": true
        }
      ]
    }
  ]
}
