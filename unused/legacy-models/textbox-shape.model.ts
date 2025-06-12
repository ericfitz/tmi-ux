import { Shape, Node } from '@antv/x6';
import { PortManager } from '@antv/x6/lib/model/port';

/**
 * Type definition for TextboxShape to help with TypeScript
 */
export interface TextboxShapeType extends Node {
  getPortsByDirection(direction: 'top' | 'right' | 'bottom' | 'left'): PortManager.Port[];
  updateHtml(text: string): TextboxShapeType;
}

/**
 * TextboxShape class for DFD diagrams
 * Represents a simple text box in the diagram
 * This shape has no ports and does not allow embedding
 */
export const TextboxShape = Shape.HTML.define({
  constructorName: 'textbox',
  width: 150,
  height: 80,
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
      class: 'textbox-shape',
    },
    fo: {
      refWidth: '100%',
      refHeight: '100%',
      html: `
        <div xmlns="http://www.w3.org/1999/xhtml" class="textbox-content">
          Text
        </div>
      `,
    },
  },
  // No ports configuration as this shape doesn't have ports
});

/**
 * Update the HTML content with the given text
 * @param text The text to display
 * @returns The shape instance
 */
(TextboxShape.prototype as TextboxShapeType).updateHtml = function (
  text: string,
): TextboxShapeType {
  const html = `
    <div xmlns="http://www.w3.org/1999/xhtml" class="textbox-content">
      ${text}
    </div>
  `;

  // Set the fo/html attribute
  this.prop('attrs/fo/html', html);

  return this;
};

/**
 * Dummy implementation of getPortsByDirection to prevent errors
 * TextboxShape doesn't have ports, so this returns an empty array
 * @param direction The port direction ('top', 'right', 'bottom', 'left')
 * @returns Empty array of ports
 */
(TextboxShape.prototype as TextboxShapeType).getPortsByDirection = function (
  _direction: 'top' | 'right' | 'bottom' | 'left',
): PortManager.Port[] {
  return [];
};
