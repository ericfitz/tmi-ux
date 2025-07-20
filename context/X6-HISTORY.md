# History

[X6](https://x6-antv-vision.translate.goog/en?_x_tr_sl=zh-CN&_x_tr_tl=en&_x_tr_hl=en&_x_tr_pto=wapp)

## Configuration

Undo/redo is disabled by default. When creating a canvas, enable the
canvas undo/redo capability through the following configuration.

```ts
const graph = new Graph({ history: true });

const graph = new Graph({
  history: {
    enabled: true,
  },
});
```

After creating the canvas, call
[graph.enableHistory()](https://x6-antv-vision.translate.goog/en/docs/api/graph/history/?_x_tr_sl=zh-CN&_x_tr_tl=en&_x_tr_hl=en&_x_tr_pto=wapp&enablehistory)
and
[graph.disableHistory()](https://x6-antv-vision.translate.goog/en/docs/api/graph/history/?_x_tr_sl=zh-CN&_x_tr_tl=en&_x_tr_hl=en&_x_tr_pto=wapp&disablehistory)
to enable and disable.

```ts
if (graph.isHistoryEnabled()) {
  graph.disableHistory();
} else {
  graph.enableHistory();
}
```

The supported options are:

```ts
interface HistoryOptions {
    ignoreAdd?: boolean,
    ignoreRemove?: boolean,
    ignoreChange?: boolean,
    beforeAddCommand?: \<T extends ModelEvents\>( this: HistoryManager, event: T, args: Model.EventArgs\[T\]) => any,
    afterAddCommand?: \<T extends ModelEvents\>( this: HistoryManager, event: T, args: Model.EventArgs\[T\], cmd: Command) => any,
    executeCommand?: ( this: HistoryManager, cmd: Command, revert: boolean, options: KeyValue, ) => any,
    revertOptionsList?: string\[\] applyOptionsList?: string\[\]
}
```

### **[ignoreAdd, ignoreRemove, ignoreChange]{.underline}**

By default, any changes (additions/deletions/property changes) to
nodes/edges in the canvas will be tracked. We provide some

options to control which changes need to be tracked:

ignoreAdd Whether to ignore adding,
the default is yes

false .

ignoreRemove Whether to ignore deletion, default is yes

false .

ignoreChange Whether to ignore
property changes, default is yes

false .

For example, the following configuration only tracks changes to the
properties of nodes and edges:

```ts
const graph = new Graph({
  history: {
    enabled: true,
    ignoreAdd: true,
    ignoreRemove: true,
    ignoreChange: false,
  },
});
```

### **[beforeAddCommand]{.underline}**

When called before a command is added to the Undo queue, if this
method returns false , the command will not be added to the Undo
queue.

```ts
const graph = new Graph({
  history: {
    enabled: true,

    beforeAddCommand(event, args) {
      if (args.options) {
        return args.options.ignore !== false;
      }
    },
  },
});
```

### **afterAddCommand**

**executeCommand**

Called after a command is added to the Undo queue.

```ts
executeCommand?: ( this: HistoryManager, cmd: Command, revert: boolean, options: KeyValue) => any
```

It is called when a command is undone or redone. If , revert it true
means the command is undone, otherwise it means the command is redone.

### **revertOptionsList** {#revertoptionslist-1}

An array of option names to pass to the undo action.

```ts
const graph = new Graph({ history: {enabled: true, revertOptionsList: [ 'option1' ] }, })

node.prop('name', 'value', { option1: 5, option graph.undo()}); // => calls node.prop('name', 'pr
```

### **applyOptionsList**

An array of option names passed to the redo action.

```ts
const graph = new Graph({ history: {enabled: true, applyOptionsList: [ 'option2' ] } } )

node.set('name', 'value', { option1: 5, option2 graph.undo()});

graph.redo(); // => calls node.set('name', 'val
```

## method

### **[undo(...)]{.underline}**

undo(options?: KeyValue): this

Cancel. options Will be passed to the event callback.

### **[undoAndCancel(...)]{.underline}**

undoAndCancel(options?: KeyValue): this

Undo and do not add to the redo queue, so this undone command cannot
be redone. options Will be passed to the event callback.

### **[redo(...)]{.underline}**

redo(options?: KeyValue): this

Redo. options will be passed to the event callback.

### **[canUndo()]{.underline}** {#canundo-1}

canUndo(): boolean

Whether it can be revoked.

### **[canRedo()]{.underline}** {#canredo-1}

###

canRedo(): boolean

Can it be redone?

### **cleanHistory(...)**

cleanHistory(options?: KeyValue): this

Clear the history state. options Will be passed to the event callback.

### **isHistoryEnabled()** {#ishistoryenabled-1}

isHistoryEnabled(): boolean

Whether the history state is enabled.

### **enableHistory()** {#enablehistory-1}

enableHistory(): this

Enable history state.

### **disableHistory()** {#disablehistory-1}

disableHistory(): this

Disable history state.

### **toggleHistory(...)**

toggleHistory(enabled?: boolean): this

Toggles the history on and off.

parameter

| name | type | Required | default | describe |
| | | | value | |
| enabled | boolean | | - | Whether to |
| | | | | enable the |
| | | | | history |
| | | | | state. By |
| | | | | default, the |
| | | | | history |
| | | | | state is |
| | | | | switched on |
| | | | | and off. |
+-------------+------------+-------------+-----------+----------------+

## event

### **[undo]{.underline}**

Fired when a command is canceled.

```ts
graph.history.on('undo', (args: { cmds: Command[]; options: KeyValue }) => {
  // code here
});
```

### **[redo]{.underline}** {#redo-1}

Fired when a command is redone.

```ts
graph.history.on(
  'redo',
  (args: {
    cmds: Command[];

    options: KeyValue;
  }) => {
    // code here
  },
);
```

### **[cancel]{.underline}**

###

Fired when a command is cancelled.

```ts
graph.history.on(
  'cancel',
  (args: {
    cmds: Command[];

    options: KeyValue;
  }) => {
    // code here
  },
);
```

### **[add]{.underline}**

Fired when a command is added to the queue.

```ts
graph.history.on('add', (args: { cmds: Command[]; options: KeyValue }) => {
  // code here
});
```

### **[clean]{.underline}**

Fired when the history queue is emptied.

```ts
graph.history.on('clean', (args: { cmds: Command[] | null; options: KeyValue }) => {
  // code here
});
```

### **[change]{.underline}**

Fired when the history queue changes.

```ts
graph.history.on('change', (args: { cmds: Command[] | null; options: KeyValue }) => {
  // code here
});
```

### **[batch]{.underline}**

Emitted when a batch command is received.

```ts
graph.history.on('batch', (args: { cmd: Command; options: KeyValue }) => {
  // code here
});
```
