"""Affix and skill-affix ID tables for the native D4 loot filter format.

Originally copied wholesale from Upsilon72/d4-filter-generator (MIT-style
credit: "Research and reverse-engineering by Upsilon72 with Claude"), not
independently reverse-engineered by this project.

2026-09-22 CORRECTION: found and fixed real errors in that inherited data,
and filled in the SKILL_AFFIX_IDS gap for every class (previously only
Warlock had any confirmed ids). Source: github.com/ThunderEagle/D4LootBench's
`src/D4LootBench.Core/Data/d4-data.json` - a maintained, purpose-built
database for this exact filter format (294 affixes, 224 skills, 27 item
types, each with a `hash` AND, for most entries, a `snoName` - the actual
internal game-engine identifier, e.g. "S04_CritChance" - which is about as
close to ground truth as this project can get without datamining the game
directly). Cross-checking against it found genuine transcription/mapping
errors in the ORIGINAL Upsilon72-sourced data:
  - Willpower, Attack Speed, Critical Strike Chance, Critical Strike Damage
    Multiplier and All Damage Multiplier had each other's ids (a shuffled
    cluster in the 0x1BEAB4-0x1BEAD4 range) - all 5 corrected.
  - Resource Cost Reduction was off by 2 (0x1D3A0F -> the real
    "%Resource Cost Reduction (AllClasses_Lesser)" is 0x1D3A11).
  - GENERIC_SKILL_AFFIX_IDS["All Skills"] was actually Warlock's own
    "Tyrant's Grasp" id; the real "+All Skills" (X2_SkillRankBonus_AllSkills)
    was, in an unrelated mix-up, sitting under SKILL_AFFIX_IDS.warlock's old
    "Hell Fracture" entry instead.
  - 9 of Warlock's original 13 skill entries had each other's ids (a
    shuffled cluster in the 0x0026AD42-0x0026ADCD range) - all corrected
    using D4LootBench's `snoName` (e.g. "X2_SkillRankBonus_Warlock_Core_
    BlazingScream") as the tiebreaker.
Every other class's SKILL_AFFIX_IDS entries below are new (were previously
either missing entirely or `None`) - same source, same confidence level
(a maintained third-party database with engine-internal names as backing
evidence, not this project's own single-affix-export verification). If
anything generated from these ever looks wrong in-game, the fully reliable
fallback is the same method used to confirm the Helm/Pants ItemType ids: a
real single-condition test filter, built in-game and decoded.
"""

from __future__ import annotations

# fmt: off
AFFIX_IDS: dict[str, int] = {
    # Offensive
    "Weapon Damage":                      0x0027FC93,
    "Strength":                           0x001BEAC2,
    "Intelligence":                       0x001BEABE,
    "Willpower":                          0x001BEAC6,
    "Dexterity":                          0x001BEABA,
    "Thorns":                             0x001BEB22,
    "All Damage Multiplier":              0x001BEAD4,
    "Attack Speed":                       0x001BEAB4,
    "Critical Strike Chance":             0x001BEACE,
    "Critical Strike Damage Multiplier":  0x001BEAD2,
    "Vulnerable Damage Multiplier":       0x001BFC80,
    "Damage Over Time Multiplier":        0x001BEAD6,
    "Cold Damage Multiplier":             0x00270AF5,
    "Fire Damage Multiplier":             0x00270AF7,
    "Holy Damage Multiplier":             0x00270AFF,
    "Lightning Damage Multiplier":        0x00270AFD,
    "Physical Damage Multiplier":         0x00270AD0,
    "Poison Damage Multiplier":           0x00270AFB,
    "Shadow Damage Multiplier":           0x00270AF9,
    # Defensive
    "Maximum Life":                       0x001BEAD8,
    "Life Regeneration":                  0x001BEADA,
    "Life On Hit":                        0x001D5E13,
    "Life on Kill":                       0x0025DA8C,
    "Armor":                              0x001BEAB2,
    "Resistance to All Elements":         0x001BFD38,
    "Fire Resistance":                    0x001BEAEE,
    "Cold Resistance":                    0x001BEB2E,
    "Lightning Resistance":               0x001BEAF2,
    "Poison Resistance":                  0x001BEAF4,
    "Shadow Resistance":                  0x001BEAF6,
    "Physical Resistance":                0x002557E4,
    "Damage Reduction":                   0x001D6E63,
    "Dodge Chance":                       0x001BFC85,
    # Resource
    "Maximum Resource":                   0x001BFC79,
    "Energy Regeneration":                0x001D5E30,
    "Essence Regeneration":               0x001D5E3A,
    "Fury Regeneration":                  0x001D5E38,
    "Mana Regeneration":                  0x001D5E36,
    "Spirit Regeneration":                0x001D5E33,
    "Vigor Regeneration":                 0x001EB549,
    "Faith Regeneration":                 0x002674B9,
    "Wrath Regeneration":                 0x0026A37C,
    "Energy On Kill":                     0x001D5E25,
    "Essence On Kill":                    0x001D5E27,
    "Fury On Kill":                       0x001D5E29,
    "Mana On Kill":                       0x001D5E2B,
    "Spirit On Kill":                     0x001D5E2D,
    "Vigor On Kill":                      0x001EB481,
    "Faith On Kill":                      0x002674BB,
    "Wrath every 10 Kills":               0x0026A374,
    "Resource Cost Reduction":            0x001D3A11,
    "Resource Generation":                0x001BEB20,
    "Lucky Hit Restore Primary Resource": 0x0024527F,
    # Utility
    "Potion Capacity":                    0x001BEAE2,
    "Lucky Hit Chance":                   0x001BEADC,
    "Healing Received":                   0x001BFCBF,
    "Fortify Generation":                 0x00266B1E,
    "Barrier Generation":                 0x00266B22,
    # Found decoding a real user filter and independently re-confirmed
    # bulk-decoding diablofilter.com filters (2026-09-22) - a "Ranks to X
    # Skills" category affix, same shape as the entries above, not tied to
    # one specific active skill name, so it belongs here rather than in
    # SKILL_AFFIX_IDS.
    "Imbuement Skills":                   0x001D6E45,
    # Mobility
    "Movement Speed":                     0x001BEADE,
    "Attacks Reduce Evade Cooldown":      0x0026C56C,
    "Maximum Evade Charge":               0x0026C56E,
    "Evade Grants Movement Speed":        0x0026C570,
}
# fmt: on

CORE_STAT_GROUPS: dict[str, list[str]] = {
    "Offensive - Damage": [
        "All Damage Multiplier", "Critical Strike Chance", "Critical Strike Damage Multiplier",
        "Attack Speed", "Vulnerable Damage Multiplier", "Fire Damage Multiplier",
        "Shadow Damage Multiplier", "Cold Damage Multiplier", "Lightning Damage Multiplier",
        "Physical Damage Multiplier", "Poison Damage Multiplier", "Holy Damage Multiplier",
        "Damage Over Time Multiplier", "Weapon Damage",
    ],
    "Offensive - Primary Stats": ["Strength", "Intelligence", "Willpower", "Dexterity"],
    "Resource": [
        "Wrath Regeneration", "Mana Regeneration", "Fury Regeneration", "Energy Regeneration",
        "Essence Regeneration", "Spirit Regeneration", "Vigor Regeneration", "Faith Regeneration",
        "Resource Cost Reduction", "Resource Generation",
    ],
    "Defensive": [
        "Maximum Life", "Armor", "Damage Reduction", "Dodge Chance",
        "Resistance to All Elements", "Fire Resistance", "Cold Resistance",
        "Lightning Resistance", "Poison Resistance", "Shadow Resistance", "Physical Resistance",
        "Life Regeneration", "Life On Hit", "Life on Kill",
    ],
    "Utility": [
        "Lucky Hit Chance", "Lucky Hit Restore Primary Resource", "Healing Received",
        "Barrier Generation", "Fortify Generation", "Potion Capacity",
    ],
    "Mobility": [
        "Movement Speed", "Maximum Evade Charge", "Attacks Reduce Evade Cooldown",
        "Evade Grants Movement Speed",
    ],
}

# "+X to <skill/category>" gear affixes, one table per class. See this
# module's docstring (2026-09-22 correction) for sourcing/confidence.
# fmt: off
SKILL_AFFIX_IDS: dict[str, dict[str, int | None]] = {
    "warlock": {
        "Hellfire Skills": 0x0026ADC4, "Occult Skills": 0x0026ADC2, "Demonology Skills": 0x0026ADC8,
        "Sigil of Chaos": 0x0026AD8B, "Sigil of Summons": 0x0026AD89, "Sigil of Subversion": 0x0026AD87,
        "Blazing Scream": 0x0026AD46, "Bombardment": 0x0026ADCD, "Rampage": 0x0026AD7E,
        "Tyrant's Grasp": 0x0026AD83, "Dread Claws": 0x0026AD48, "Hell Fracture": 0x0026AD42,
        "Abyss Skills": 0x0026ADC6, "Command Fallen": 0x0026AD4D, "Dark Prison": 0x0026AD7A,
        "Defensive Skills": 0x001D6E2B, "Doom": 0x0026AD6A, "Hellion Sting": 0x0026AD6C,
        "Infernal Breath": 0x0026AD80, "Molten Bomb": 0x0026AD68, "Nether Step": 0x0026AD7C,
        "Profane Sentinel": 0x0026AD85, "Tortured Wretch": 0x0026AD78, "Umbral Chains": 0x0026AD44,
        "Wall of Agony": 0x0026AD71,
    },
    "barbarian": {
        "Ancients Skills": 0x002782A5, "Bash": 0x001C60BC, "Bludgeoning Skills": 0x00280B83,
        "Brawling Skills": 0x001D6E25, "Challenging Shout": 0x001C692A, "Charge": 0x001C692C,
        "Death Blow": 0x001C692E, "Defensive Skills": 0x001D6E2B, "Double Swing": 0x001C6908,
        "DualWield Skills": 0x00280B85, "Dust Devil": 0x002782A9, "Earthquake": 0x002782AB,
        "Flay": 0x001C60C0, "Frenzy": 0x001C60C2, "Ground Stomp": 0x001C6935,
        "Hammer of the Ancients": 0x001C68CB, "Iron Shrapnel": 0x002782AF, "Iron Skin": 0x001C6938,
        "Kick": 0x001C693A, "Leap": 0x001C6941, "Lunging Strike": 0x001C60C4,
        "Mighty Throw": 0x001E79A1, "Rallying Cry": 0x001C6943, "Rend": 0x001C68F6,
        "Rupture": 0x001C6945, "Slashing Skills": 0x00280B87, "Steel Grasp": 0x001C6947,
        "Upheaval": 0x001C690E, "War Cry": 0x001C6949, "WeaponMastery Skills": 0x001D6E27,
        "Whirlwind": 0x001C6920,
    },
    "druid": {
        "Blood Howl": 0x001CC06D, "Boulder": 0x001CC06F, "Claw": 0x001CC054,
        "Companion Skills": 0x001D6E2D, "Cyclone Armor": 0x001CC071, "Debilitating Roar": 0x001CC073,
        "Defensive Skills": 0x001D6E2B, "Earth Skills": 0x00280B89, "Earth Spike": 0x001CC052,
        "Earthen Bulwark": 0x001CC075, "Human Skills": 0x002782B7, "Hurricane": 0x001CC077,
        "Landslide": 0x001CC062, "Lightning Storm": 0x001CC068, "Maul": 0x001CC060,
        "NatureMagic Skills": 0x00280B8B, "Poison Creeper": 0x001CC18A, "Projectile Skill Damage": 0x001D6E65,
        "Pulverize": 0x001CC064, "Rabies": 0x001CC183, "Ravens": 0x001CC185,
        "Shapeshifting Skills": 0x00280B8D, "Shred": 0x001CC06A, "Stone Burst": 0x001E791E,
        "Storm Skills": 0x00280B8F, "Storm Strike": 0x001CC056, "Tornado": 0x001CC066,
        "Trample": 0x001CC188, "Versatile Skills": 0x002782B9, "Werebear Skills": 0x00280B91,
        "Werewolf Skills": 0x00280B93, "Wind Shear": 0x001CC058, "Wolves": 0x001CC18D,
        "Wrath Skills": 0x001D6E33,
    },
    "necromancer": {
        "Blight": 0x001C7E9A, "Blood Lance": 0x001C7EB0, "Blood Mist": 0x001C7EB2,
        "Blood Skills": 0x00280B95, "Blood Surge": 0x001C7EA8, "Bone Prison": 0x001C7EB6,
        "Bone Skills": 0x00280B97, "Bone Spear": 0x001C7E90, "Bone Spirit": 0x001C7EB8,
        "Bone Splinters": 0x001C7E6E, "Corpse Explosion": 0x001C7EBA, "Corpse Skills": 0x001D6E4B,
        "Corpse Tendrils": 0x001C7EBC, "Curse Skills": 0x001D6E49, "Darkness Skills": 0x00280B99,
        "Decompose": 0x001C7E7D, "Decrepify": 0x001C7EBE, "Golem": 0x001D6E53,
        "Hemorrhage": 0x001C7E84, "Iron Maiden": 0x001C7EC0, "Macabre Skills": 0x001D6E47,
        "Minion Skills": 0x00280B9B, "Projectile Skill Damage": 0x001D6E65, "Reap": 0x001C7E88,
        "Sever": 0x001C7EA1, "Skeleton Mage": 0x001D6E51, "Skeleton Warrior": 0x001D6E4F,
    },
    "rogue": {
        "Agility Skills": 0x001D6E41, "Arrow Storm": 0x002782B5, "Barrage": 0x001C953F,
        "Blade Shift": 0x001C9537, "Caltrops": 0x001C9547, "Cold Imbuement": 0x001C9549,
        "Concealment": 0x001C954B, "Cutthroat Skills": 0x00280BA1, "Dance of Knives": 0x001E7931,
        "Dark Shroud": 0x001C954D, "Dash": 0x001C954F, "Flurry": 0x001C953D,
        "Forceful Arrow": 0x001C9535, "Grenade Skills": 0x002782B1, "Heartseeker": 0x001C952F,
        "Invigorating Strike": 0x001C9533, "Marksman Skills": 0x00280BA5, "Penetrating Shot": 0x001C9543,
        "Poison Imbuement": 0x001C9545, "Poison Trap": 0x001C9551, "Projectile Skill Damage": 0x001D6E65,
        "Puncture": 0x001C9531, "Rapid Fire": 0x001C953B, "Shade Skills": 0x002782B3,
        "Shadow Imbuement": 0x001C9553, "Shadow Step": 0x001C9555, "Smoke Grenade": 0x001C9557,
        "Subterfuge Skills": 0x001D6E43, "Trap Skills": 0x00280BA7, "Twisting Blades": 0x001C9541,
    },
    "sorcerer": {
        "Arc Lash": 0x001D6752, "Ball Lightning": 0x001D6754, "Blizzard": 0x001D6756,
        "Chain Lightning": 0x001D6743, "Charged Bolts": 0x001D6745, "Conjuration Skills": 0x001D6E3D,
        "Defensive Skills": 0x001D6E2B, "Familiar": 0x001E79A8, "Fire Bolt": 0x001D674D,
        "Fireball": 0x001D673F, "Firewall": 0x001D6758, "Flame Shield": 0x001D675A,
        "Frost Bolt": 0x001D6750, "Frost Nova": 0x001D675C, "Frost Skills": 0x00280BA9,
        "Frozen Orb": 0x001D6749, "Hydra": 0x001D675E, "Ice Armor": 0x001D6760,
        "Ice Blades": 0x001D6762, "Ice Shards": 0x001D6741, "Incinerate": 0x001D6747,
        "Lightning Spear": 0x001D6764, "Mastery Skills": 0x001D6E3F, "Meteor": 0x001D6766,
        "Projectile Skill Damage": 0x001D6E65, "Pyromancy Skills": 0x00280BAB, "Shock Skills": 0x00280BAD,
        "Spark": 0x001D674B, "Teleport": 0x001D6768,
    },
    "spiritborn": {
        "Armored Hide": 0x001EC1B8, "Centipede Skills": 0x00280BAF, "ConcussiveStormp Skills": 0x001ED05A,
        "Counterattack": 0x001ED0CB, "Crushing Hand": 0x001EBD36, "Defensive Skills": 0x001D6E2B,
        "Eagle Skills": 0x00280BB1, "Focus Skills": 0x001EBDFD, "Gorilla Skills": 0x00280BB3,
        "Jaguar Skills": 0x00280BB5, "Payback": 0x001ED2E9, "Potency Skills": 0x001ED2C8,
        "Quill Volley": 0x001EBD49, "Rake": 0x001EBD60, "Ravager": 0x001EC119,
        "Razor Wings": 0x001ED2F1, "Rock Splitter": 0x001EB8A4, "Rushing Claw": 0x001ED338,
        "Scourge": 0x001ED1D4, "Soar": 0x001EC0FE, "Stinger": 0x001EBDB9,
        "Thrash": 0x001EBBB7, "Thunderspike": 0x001EBBAD, "Touch of Death": 0x001ED34D,
        "Toxic Skin": 0x001EC199, "Vortex": 0x001EBEE9, "Withering Fist": 0x001EBD1B,
    },
    "paladin": {
        "Advance": 0x002539AB, "Aegis": 0x00261ACE, "Arbiter of Justice": 0x00261ACC,
        "Aura Skills": 0x00261AC2, "Blessed Hammer": 0x0024F057, "Blessed Shield": 0x0024F051,
        "Brandish": 0x00253A6C, "Clash": 0x00261AA7, "Condemn": 0x00261AE8,
        "Consecration": 0x00261AE4, "Defiance Aura": 0x00261ABF, "Disciple Skills": 0x00280B9D,
        "Divine Lance": 0x0025B0E2, "Falling Star": 0x00261ADD, "Fanaticism Aura": 0x00261ABB,
        "Holy Bolt": 0x00261AA5, "Holy Light Aura": 0x00261ABD, "Juggernaut Skills": 0x00280B9F,
        "Purify": 0x00261AE6, "Rally": 0x00261AE2, "Shield Bash": 0x0025122E,
        "Shield Charge": 0x00261AD8, "Spear of the Heavens": 0x00261AEA, "Valor Skills": 0x00261AC7,
        "Zealot Skills": 0x0024F06A,
    },
}
# fmt: on

# Class-agnostic "skill" affixes.
GENERIC_SKILL_AFFIX_IDS: dict[str, int] = {
    "Core Skills": 0x001D6E31,
    "All Skills": 0x00273C0A,
}
