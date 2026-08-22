import '@testing-library/jest-dom/vitest';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock;

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => {
    const parseMaxWidth = query.match(/max-width:\s*(\d+)px/)
    const parseMinWidth = query.match(/min-width:\s*(\d+)px/)
    const parseMaxHeight = query.match(/max-height:\s*(\d+)px/)
    const parseMinHeight = query.match(/min-height:\s*(\d+)px/)

    let matches = false
    if (parseMaxWidth) matches = window.innerWidth <= parseInt(parseMaxWidth[1])
    else if (parseMinWidth) matches = window.innerWidth >= parseInt(parseMinWidth[1])
    else if (parseMaxHeight) matches = window.innerHeight <= parseInt(parseMaxHeight[1])
    else if (parseMinHeight) matches = window.innerHeight >= parseInt(parseMinHeight[1])

    return {
      matches,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }
  },
});
