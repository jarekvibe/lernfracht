import { h } from '../dom.js';
import { icon } from './icon.js';

/** @type {{id: string, href: string, label: string, icon: Parameters<typeof icon>[0]}[]} */
export const TABS = [
  { id: 'learn', href: '#/home', label: 'Lernen', icon: 'learn' },
  { id: 'mistakes', href: '#/mistakes', label: 'Fehlerkiste', icon: 'mistakes' },
  { id: 'exam', href: '#/exam', label: 'Klausur', icon: 'exam' },
  { id: 'league', href: '#/league', label: 'Liga', icon: 'league' },
  { id: 'profile', href: '#/profile', label: 'Profil', icon: 'profile' },
];

export function bottomNav() {
  const links = TABS.map((tab) =>
    h('a', { class: 'tab', href: tab.href, 'data-tab': tab.id }, icon(tab.icon), h('span', null, tab.label)),
  );
  const nav = h('nav', { class: 'tabbar', 'aria-label': 'Hauptnavigation' }, links);
  return {
    el: nav,
    /** @param {string|null} activeId */
    setActive(activeId) {
      for (const link of links) {
        if (link.dataset.tab === activeId) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      }
    },
  };
}
