const NOTEBOOK_LIST = '.notebook-list';
let scheduled = false;

const parseHiddenCount = (text: string) => {
  const match = text.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
};

function refreshNotebookStream() {
  scheduled = false;
  const list = document.querySelector<HTMLElement>(NOTEBOOK_LIST);
  if (!list) return;

  const wrappers = [...list.children].filter((node): node is HTMLElement => node instanceof HTMLElement && Boolean(node.querySelector('.notebook-row')));
  let waitingCount = 0;

  wrappers.forEach((wrapper) => {
    const waiting = Boolean(wrapper.querySelector('.waiting-line'));
    wrapper.classList.toggle('chat-waiting-wrap', waiting);
    if (waiting) waitingCount += 1;
  });

  let divider = list.querySelector<HTMLElement>(':scope > .chat-wait-divider');
  if (waitingCount > 0) {
    if (!divider) {
      divider = document.createElement('div');
      divider.className = 'chat-wait-divider';
      divider.innerHTML = '<span>Жду</span><b></b>';
      list.appendChild(divider);
    }
    const badge = divider.querySelector('b');
    if (badge && badge.textContent !== String(waitingCount)) badge.textContent = String(waitingCount);
  } else if (divider) {
    divider.remove();
  }

  list.querySelectorAll<HTMLElement>('.timeline-scroll').forEach((timeline) => {
    const steps = [...timeline.querySelectorAll<HTMLElement>('.timeline-step')];
    const expanded = timeline.classList.contains('is-expanded');
    const existingButtons = [...timeline.querySelectorAll<HTMLButtonElement>('.history-more:not(.chat-local-history)')];
    const collapsedButton = existingButtons.find((button) => button.textContent?.includes('раньше'));
    const collapseButton = existingButtons.find((button) => button.textContent?.trim() === 'свернуть');

    if (expanded) {
      if (collapseButton && collapseButton.textContent !== 'Свернуть историю') collapseButton.textContent = 'Свернуть историю';
      timeline.querySelector('.chat-local-history')?.remove();
      return;
    }

    if (collapsedButton) {
      const hidden = parseHiddenCount(collapsedButton.textContent || '');
      const total = hidden + steps.length;
      const label = `История · ${total}`;
      if (collapsedButton.textContent !== label) collapsedButton.textContent = label;
      timeline.querySelector('.chat-local-history')?.remove();
      return;
    }

    // React renders the last 4 updates even when there is no built-in history button.
    // Our chat surface shows only 3; for exactly 4 we add a tiny local reveal control.
    if (steps.length === 4) {
      let local = timeline.querySelector<HTMLButtonElement>('.chat-local-history');
      if (!local) {
        local = document.createElement('button');
        local.type = 'button';
        local.className = 'history-more chat-local-history';
        const track = timeline.querySelector('.timeline-track');
        track?.insertBefore(local, track.firstChild);
        local.addEventListener('click', () => {
          const showing = timeline.classList.toggle('chat-show-local-history');
          if (local) local.textContent = showing ? 'Свернуть историю' : 'История · 4';
        });
      }
      const wanted = timeline.classList.contains('chat-show-local-history') ? 'Свернуть историю' : 'История · 4';
      if (local.textContent !== wanted) local.textContent = wanted;
    } else {
      timeline.querySelector('.chat-local-history')?.remove();
      timeline.classList.remove('chat-show-local-history');
    }
  });
}

function scheduleRefresh() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(refreshNotebookStream);
}

export function initWorkChatExperience() {
  scheduleRefresh();
  const observer = new MutationObserver(scheduleRefresh);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}
