// Abzeichen (SPEC §4.8), datengetrieben: jede Definition prüft einen Kontext.

/**
 * @typedef {Object} BadgeContext
 * @property {number} sessions finished sessions overall
 * @property {number} streak current streak
 * @property {number} greenTopics topics at ≥ 80 % mastery
 * @property {number} exams exam simulations taken
 * @property {number|null} bestGrade best exam grade (1 = best)
 * @property {number} mistakesBefore mistake box size before the session
 * @property {number} mistakesAfter
 * @property {{mode: string, total: number, perfect: boolean}|null} session the session just finished
 * @property {number} hour local hour when it finished
 *
 * @typedef {Object} Badge
 * @property {string} id
 * @property {string} icon
 * @property {string} title
 * @property {string} description
 * @property {(c: BadgeContext) => boolean} earned
 */

/** @type {readonly Badge[]} */
export const BADGES = Object.freeze([
  { id: 'first_lesson', icon: '📦', title: 'Erste Lektion', description: 'Die erste Lektion ist geschafft.', earned: (c) => c.sessions >= 1 },
  { id: 'streak_3', icon: '🔥', title: '3-Tage-Streak', description: '3 Tage am Stück gelernt.', earned: (c) => c.streak >= 3 },
  { id: 'streak_7', icon: '🔥', title: '7-Tage-Streak', description: 'Eine ganze Woche dran geblieben.', earned: (c) => c.streak >= 7 },
  { id: 'streak_30', icon: '🏆', title: '30-Tage-Streak', description: '30 Tage am Stück. Respekt.', earned: (c) => c.streak >= 30 },
  {
    id: 'perfect_lesson',
    icon: '✨',
    title: 'Perfekte Lektion',
    description: 'Alles beim ersten Versuch richtig.',
    earned: (c) => Boolean(c.session && c.session.mode !== 'mistakes' && c.session.perfect),
  },
  // ASSUMPTION: „Thema gemeistert“ = Ampel grün (≥ 80 % in Box 4+), nicht 100 %.
  { id: 'topic_mastered', icon: '🎯', title: 'Thema gemeistert', description: 'Ein Thema ist klausurbereit.', earned: (c) => c.greenTopics >= 1 },
  { id: 'first_exam', icon: '📝', title: 'Erste Klausur-Simulation', description: 'Einmal unter Prüfungsbedingungen.', earned: (c) => c.exams >= 1 },
  { id: 'exam_grade_2', icon: '🏅', title: 'Klausur mit Note 2', description: 'Note 2 oder besser in der Simulation.', earned: (c) => c.bestGrade !== null && c.bestGrade <= 2 },
  {
    id: 'mistakes_cleared',
    icon: '🧹',
    title: 'Fehlerkiste geleert',
    description: 'Alle Fehler nachgeübt.',
    earned: (c) => c.mistakesBefore > 0 && c.mistakesAfter === 0,
  },
  { id: 'night_shift', icon: '🌙', title: 'Nachtschicht', description: 'Eine Lektion nach 22 Uhr.', earned: (c) => Boolean(c.session) && c.hour >= 22 },
  { id: 'early_shift', icon: '🌅', title: 'Frühschicht', description: 'Eine Lektion vor 7 Uhr.', earned: (c) => Boolean(c.session) && c.hour < 7 },
]);

/**
 * Badges that are earned now but not yet stored.
 * @param {Record<string, string>} owned id → date earned
 * @param {BadgeContext} context
 * @returns {Badge[]}
 */
export function newBadges(owned, context) {
  return BADGES.filter((badge) => !owned[badge.id] && badge.earned(context));
}

/** @param {string} id */
export const badgeById = (id) => BADGES.find((b) => b.id === id) ?? null;
