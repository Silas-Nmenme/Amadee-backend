import { api, formatNaira, safeText } from './utils.js';

export function initPromotionAnnouncements(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  async function loadPromotions() {
    try {
      const { promotions } = await api('/promos/active');
      container.replaceChildren();
      container.hidden = !promotions.length;
      for (const promotion of promotions) {
        const name = promotion.name || promotion.code;
        const card = document.createElement('article');
        card.className = 'promotion-card';
        card.append(
          safeText('p', name, 'eyebrow'),
          safeText('h2', promotion.announcementText || `${name} is on now.`),
          safeText('p', `${promotion.type === 'percent' ? `${promotion.value}% off` : `${formatNaira(promotion.value)} off`} with code ${promotion.code}.`),
        );
        if (promotion.minSubtotal > 0) {
          card.append(safeText('p', `On orders from ${formatNaira(promotion.minSubtotal)}.`));
        }
        if (promotion.applicableProductCodes?.length) {
          card.append(safeText('p', `Eligible product codes: ${promotion.applicableProductCodes.join(', ')}.`));
        }
        if (promotion.expiresAt) {
          card.append(safeText('p', `Ends ${new Date(promotion.expiresAt).toLocaleDateString('en-NG')}.`));
        }
        container.append(card);
      }
    } catch (error) {
      container.hidden = false;
      container.replaceChildren(safeText('p', `Promotions could not be loaded: ${error.message}`, 'promotion-error'));
    }
  }

  loadPromotions();
  window.setInterval(loadPromotions, 60000);
}
