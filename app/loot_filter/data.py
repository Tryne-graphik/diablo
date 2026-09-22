"""Affix and skill-affix ID tables for the native D4 loot filter format.

Copied from Upsilon72/d4-filter-generator (MIT-style credit: "Research and
reverse-engineering by Upsilon72 with Claude"), not independently
reverse-engineered here. See that project's README for their verification
method (single-affix filter exports, decoded by hand).

Known gap, inherited as-is: the 77 AFFIX_IDS are universal (any class) and
fully confirmed. SKILL_AFFIX_IDS - the "+X to <category> Skills" gear
affixes - are only confirmed for Warlock; every other class's entries in
Upsilon72's source have `id: null` ("pending confirmation", their own
words). A filter generated for e.g. Rogue can use all 77 stat affixes but
cannot target Rogue-specific skill-category affixes until someone with the
game does the same single-affix-export verification Upsilon72 did for
Warlock (their README estimates ~15 min/class) - flagged to the user
rather than guessed at.
"""

from __future__ import annotations

# fmt: off
AFFIX_IDS: dict[str, int] = {
    # Offensive
    "Weapon Damage":                      0x0027FC93,
    "Strength":                           0x001BEAC2,
    "Intelligence":                       0x001BEABE,
    "Willpower":                          0x001BEAB4,
    "Dexterity":                          0x001BEABA,
    "Thorns":                             0x001BEB22,
    "All Damage Multiplier":              0x001BEAC6,
    "Attack Speed":                       0x001BEACE,
    "Critical Strike Chance":             0x001BEAD2,
    "Critical Strike Damage Multiplier":  0x001BEAD4,
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
    "Resource Cost Reduction":            0x001D3A0F,
    "Resource Generation":                0x001BEB20,
    "Lucky Hit Restore Primary Resource": 0x0024527F,
    # Utility
    "Potion Capacity":                    0x001BEAE2,
    "Lucky Hit Chance":                   0x001BEADC,
    "Healing Received":                   0x001BFCBF,
    "Fortify Generation":                 0x00266B1E,
    "Barrier Generation":                 0x00266B22,
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

# "+X to <category> Skills" gear affixes. Only Warlock's are confirmed
# (id set); every other class is listed with id=None so the gap is
# explicit and callers can warn rather than silently generate a filter
# that won't actually match anything in-game for that class.
SKILL_AFFIX_IDS: dict[str, dict[str, int | None]] = {
    "warlock": {
        "Hellfire Skills": 0x0026ADC4,
        "Occult Skills": 0x0026ADC6,
        "Demonology Skills": 0x0026ADCD,
        "Sigil of Chaos": 0x0026ADC2,
        "Sigil of Summons": 0x0026ADC8,
        "Sigil of Subversion": 0x0026AD87,
        "Blazing Scream": 0x0026AD89,
        "Bombardment": 0x0026AD8B,
        "Rampage": 0x0026AD7E,
        "Tyrant's Grasp": 0x0026AD46,
        "Dread Claws": 0x0026AD48,
        "Hell Fracture": 0x00273C0A,
        "Abyss Skills": 0x0026AD42,
    },
    "barbarian": {"Bash": None, "Whirlwind": None, "Hammer of the Ancients": None, "Leap": None, "Rend": None, "Weapon Mastery Skills": None},
    "druid": {"Landslide": None, "Tornado": None, "Pulverize": None, "Shred": None, "Wolves": None},
    "necromancer": {"Bone Spear": None, "Blood Surge": None, "Corpse Explosion": None, "Bone Skills": None, "Blood Skills": None},
    "rogue": {"Twisting Blades": None, "Rapid Fire": None, "Penetrating Shot": None, "Marksman Skills": None, "Cutthroat Skills": None},
    "sorcerer": {"Fireball": None, "Ice Shards": None, "Chain Lightning": None, "Blizzard": None, "Frost Skills": None, "Pyromancy Skills": None, "Shock Skills": None},
    "spiritborn": {"Quill Volley": None, "Soar": None, "Thunderspike": None, "Eagle Skills": None, "Jaguar Skills": None},
    "paladin": {},
}

# Class-agnostic "skill" affixes (verified by Upsilon72 for any class).
GENERIC_SKILL_AFFIX_IDS: dict[str, int] = {
    "Core Skills": 0x001D6E31,
    "All Skills": 0x0026AD83,
}
