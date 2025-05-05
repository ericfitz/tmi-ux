import { Shape } from '@antv/x6';
import { PortManager } from '@antv/x6/lib/model/port';

/**
 * TextboxShape class for DFD diagrams
 * Represents a simple text box in the diagram
 * This shape has no ports and does not allow embedding
 */
export class TextboxShape extends Shape.TextBlock {
  // No port methods needed as this shape doesn't have ports

  /**
   * Update the HTML content with the given text
   * @param text The text to display
   * @returns The shape instance
   */
  updateHtml(text: string): this {
    const html = `
      <div xmlns="http://www.w3.org/1999/xhtml"
           style="width: 100%; height: 100%; padding: 5px; box-sizing: border-box;
                  font-family: 'Roboto Condensed', Arial, sans-serif;
                  font-size: 12px; color: #333333; overflow: auto;
                  word-wrap: break-word; text-align: left;">
        ${text}
      </div>
    `;

    // Set the fo/html attribute
    this.prop('attrs/fo/html', html);

    return this;
  }

  /**
   * Dummy implementation of getPortsByDirection to prevent errors
   * TextboxShape doesn't have ports, so this returns an empty array
   * @param direction The port direction ('top', 'right', 'bottom', 'left')
   * @returns Empty array of ports
   */
  getPortsByDirection(_direction: 'top' | 'right' | 'bottom' | 'left'): PortManager.Port[] {
    return [];
  }
}

// Configure TextboxShape
TextboxShape.config({
  markup: [
    {
      tagName: 'rect',
      selector: 'body',
    },
    {
      tagName: 'foreignObject',
      selector: 'fo',
    },
  ],
  attrs: {
    root: {
      magnet: false,
    },
    body: {
      fill: '#FFFFFF',
      stroke: '#333333',
      strokeWidth: 1,
      strokeDasharray: '2,2',
      opacity: 0.8,
      rx: 4,
      ry: 4,
    },
    fo: {
      refWidth: '100%',
      refHeight: '100%',
      html: `
        <div xmlns="http://www.w3.org/1999/xhtml"
             style="width: 100%; height: 100%; padding: 5px; box-sizing: border-box;
                    font-family: 'Roboto Condensed', Arial, sans-serif;
                    font-size: 12px; color: #333333; overflow: hidden;">
          Text
        </div>
      `,
    },
  },
  // No ports configuration as this shape doesn't have ports
});
