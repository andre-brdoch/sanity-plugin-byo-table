import { uuid } from '@sanity/uuid';
import React from 'react';
import PropTypes from 'prop-types';
import Table from './table';
import PatchEvent, {
  set,
  unset,
  insert,
} from 'part:@sanity/form-builder/patch-event';
import ButtonGrid from 'part:@sanity/components/buttons/button-grid';
import Button from 'part:@sanity/components/buttons/default';
import ConfirmationDialog from 'part:@sanity/components/dialogs/confirm';

const createPatchFrom = value => {
  return PatchEvent.from(set(value));
};

class RowsInput extends React.Component {
  static propTypes = {
    type: PropTypes.shape({
      title: PropTypes.string,
      description: PropTypes.string,
    }).isRequired,
    value: PropTypes.array,
    onChange: PropTypes.func.isRequired,
  };

  state = {
    dialogMsg: null,
    dialogCb: null,
  };

  getTableTypes = () => {
    const { type } = this.props;
    if (type.jsonType !== 'array' || type.of.length !== 1) {
      throw new Error(
        'The type using rows-input needs to be array of one subtype',
      );
    }
    const rowTypeObject = type.of[0];

    if (rowTypeObject.jsonType !== 'object') {
      throw new Error('The rows-input array type has to be an object');
    }

    const cellsField = rowTypeObject.fields.find(field => {
      return (
        field.type.jsonType === 'array' &&
        field.type.of.length === 1 &&
        (field.type.of[0].jsonType === 'object' ||
          field.type.of[0].jsonType === 'string')
      );
    });

    const cellType = cellsField.type.of[0];

    return {
      rowTypeName: rowTypeObject.name,
      cellsFieldName: cellsField.name,
      cellType,
    };
  };

  updateStringCell = (stringValue, rowIndex, cellIndex) => {
    const { value, onChange } = this.props;
    const { cellsFieldName } = this.getTableTypes();
    // Clone the current table data
    const newValue = [...value];
    newValue[rowIndex][cellsFieldName][cellIndex] = stringValue;
    const patchEvent = createPatchFrom(newValue);
    return onChange(patchEvent);
  };

  propagateEvent = event => this.props.onChange(event);

  newCell = cellType => {
    const _newCell =
      cellType.jsonType === 'string'
        ? ''
        : {
            _type: cellType.name,
          };
    return _newCell;
  };

  initializeTable = () => {
    const { onChange } = this.props;
    const { cellsFieldName, rowTypeName, cellType } = this.getTableTypes();
    // Add a single row with a single empty cell (1 row, 1 column)
    const newValue = [
      {
        _type: [rowTypeName],
        _key: uuid(),
        [cellsFieldName]: [this.newCell(cellType)],
      },
    ];
    return onChange(createPatchFrom(newValue));
  };

  addRow = e => {
    const { value, onChange } = this.props;
    const { cellsFieldName, rowTypeName, cellType } = this.getTableTypes();
    // If we have an empty table, create a new one
    if (!value) return this.initializeTable();
    // Clone the current table data
    const newValue = [...value];
    // Calculate the column count from the first row
    const columnCount = value[0][cellsFieldName].length;
    // Add as many cells as we have columns
    newValue.push({
      _type: rowTypeName,
      _key: uuid(),
      cells: Array(columnCount).fill(this.newCell(cellType)),
    });
    return onChange(createPatchFrom(newValue));
  };

  removeRow = index => {
    const { value, onChange } = this.props;
    // Clone the current table data
    const newValue = [...value];
    // Remove the row via index
    newValue.splice(index, 1);
    // If the last row was removed, clear the table
    if (!newValue.length) {
      this.clear();
    }
    return onChange(createPatchFrom(newValue));
  };

  handleSortEnd = ({ newIndex, oldIndex }) => {
    const { value, onChange } = this.props;
    const item = value[oldIndex];
    const refItem = value[newIndex];
    if (!item._key || !refItem._key) {
      // eslint-disable-next-line no-console
      console.error(
        'Neither the item you are moving nor the item you are moving to have a key. Cannot continue.',
      );
      return;
    }
    if (oldIndex === newIndex || item._key === refItem._key) {
      return;
    }
    onChange(
      PatchEvent.from(
        unset([{ _key: item._key }]),
        insert([item], oldIndex > newIndex ? 'before' : 'after', [
          { _key: refItem._key },
        ]),
      ),
    );
  };

  addColumn = e => {
    const { value, onChange } = this.props;
    const { cellsFieldName, cellType } = this.getTableTypes();
    // If we have an empty table, create a new one
    if (!value) return this.initializeTable();
    // Clone the current table data
    const newValue = [...value];
    // Add a cell to each of the rows
    newValue.forEach((row, i) => {
      newValue[i][cellsFieldName].push(this.newCell(cellType));
    });
    return onChange(createPatchFrom(newValue));
  };

  removeColumn = index => {
    const { value, onChange } = this.props;
    const { cellsFieldName } = this.getTableTypes();
    // Clone the current table data
    const newValue = [...value];
    // For each of the rows, remove the cell by index
    newValue.forEach(row => {
      row[cellsFieldName].splice(index, 1);
    });
    // If the last cell was removed, clear the table
    if (!newValue[0][cellsFieldName].length) {
      this.clear();
    }
    return onChange(createPatchFrom(newValue));
  };

  // Unsets the entire table value
  clear = () => {
    const { onChange } = this.props;
    return onChange(PatchEvent.from(unset()));
  };

  focus(a, b, c) {
    console.log('Got focus!!!');
    document.querySelector('.myinput').focus();
  }

  onRemoveRowRequest = index => {
    this.setState({
      dialogMsg: 'Are you sure you want to delete the table row?',
      dialogCb: () => {
        this.removeRow(index);
        this.closeDialog();
      },
    });
  };

  onRemoveColumnRequest = index => {
    this.setState({
      dialogMsg: 'Are you sure you want to delete the table column?',
      dialogCb: () => {
        this.removeColumn(index);
        this.closeDialog();
      },
    });
  };

  onClearRequest = () => {
    this.setState({
      dialogMsg: 'Are you sure you want to clear the table?',
      dialogCb: () => {
        this.clear();
        this.closeDialog();
      },
    });
  };

  closeDialog = () => {
    this.setState({
      dialogMsg: null,
      dialogCb: null,
    });
  };

  render() {
    const { type, value } = this.props;
    const { title, description } = type;
    const { dialogMsg, dialogCb } = this.state;

    const table =
      value && value.length ? (
        <Table
          rows={value}
          updateStringCell={this.updateStringCell}
          onEvent={this.propagateEvent}
          removeColumn={this.onRemoveColumnRequest}
          removeRow={this.onRemoveRowRequest}
          tableTypes={this.getTableTypes()}
          handleSortEnd={this.handleSortEnd}
        />
      ) : null;

    const buttons = value ? (
      <ButtonGrid>
        <Button inverted onClick={this.addRow}>
          Add Row
        </Button>
        <Button inverted onClick={this.addColumn}>
          Add Column
        </Button>
        <Button inverted color="danger" onClick={this.onClearRequest}>
          Clear
        </Button>
      </ButtonGrid>
    ) : (
      <Button color="primary" onClick={this.initializeTable}>
        New Table
      </Button>
    );

    const confirmationDialog =
      dialogMsg && dialogCb ? (
        <ConfirmationDialog
          onConfirm={dialogCb}
          onCancel={this.closeDialog}
          confirmColor="danger"
          confirmButtonText="Confirm"
        >
          {dialogMsg}
        </ConfirmationDialog>
      ) : null;

    return (
      <div>
        <h3>{title}</h3>
        <h5>{description}</h5>
        {table}
        {buttons}
        {confirmationDialog}
      </div>
    );
  }
}

export default RowsInput;
