// // http://forensicsfromthesausagefactory.blogspot.com/2011/05/analysis-of-record-structure-within.html
class LeafTablePage {
  constructor(/** @type{DataView} */ dataView) {
    // Ignore the header if this interior table page is the root database page
    const offset = dataView.byteOffset === 0 ? 100 : 0;

    this.pageType = dataView.getUint8(offset);
    if (this.pageType !== 0xd) {
      throw new Error('Not a leaf table page!');
    }

    this.firstFreeBlock = dataView.getUint16(offset + 1);
    this.cellCount = dataView.getUint16(offset + 3);
    this.cellContentArea = dataView.getUint16(offset + 5);
    this.fragmentedFreeBytes = dataView.getUint8(offset + 7);
    this.cells = [];
    for (let cellPointerIndex = 0; cellPointerIndex < this.cellCount; cellPointerIndex++) {
      const cellPointer = dataView.getUint16(offset + 8 + cellPointerIndex * 2);

      const lengthVarint = new VarInt(new DataView(dataView.buffer, dataView.byteOffset + cellPointer, 9));
      const rowIdVarint = new VarInt(new DataView(dataView.buffer, dataView.byteOffset + cellPointer + lengthVarint.byteLength, 9));
      const payloadHeaderLengthVarint = new VarInt(new DataView(dataView.buffer, dataView.byteOffset + cellPointer + lengthVarint.byteLength + rowIdVarint.byteLength, 9));

      // This is the number of bytes which are occupied by varints denoting the various serial types (N)
      const serialTypesVariantsByteCount = payloadHeaderLengthVarint.value - payloadHeaderLengthVarint.byteLength;

      // Read the serial type varints one by one
      let serialTypeVarintByteOffset = 0;
      const serialTypes = [];
      while (serialTypeVarintByteOffset < serialTypesVariantsByteCount) {
        const serialTypeVarint = new VarInt(new DataView(dataView.buffer, dataView.byteOffset + cellPointer + lengthVarint.byteLength + rowIdVarint.byteLength + payloadHeaderLengthVarint.byteLength + serialTypeVarintByteOffset, 9));
        serialTypes.push(serialTypeVarint.value);
        serialTypeVarintByteOffset += serialTypeVarint.byteLength;

        // https://www.sqlite.org/datatype3.html
        if (serialTypeVarint.value === 0) {
          //console.log('serial type NULL');
        } else if (serialTypeVarint.value === 1) {
          //console.log('serial type INT 8 bit / 1 byte');
        } else if (serialTypeVarint.value === 2) {
          //console.log('serial type INT 16 bit / 2 byte');
        } else if (serialTypeVarint.value === 3) {
          //console.log('serial type INT 24 bit / 3 byte');
        } else if (serialTypeVarint.value === 4) {
          //console.log('serial type INT 32 bit / 4 byte');
        } else if (serialTypeVarint.value === 5) {
          //console.log('serial type INT 48 bit / 6 byte');
        } else if (serialTypeVarint.value === 6) {
          //console.log('serial type INT 64 bit / 8 byte');
        } else if (serialTypeVarint.value === 7) {
          //console.log('serial type REAL');
        } else if (serialTypeVarint.value === 8) {
          //console.log('serial typ FALSE');
        } else if (serialTypeVarint.value === 9) {
          //console.log('serial type TRUE');
        } else if (serialTypeVarint.value === 10) {
          //console.log('serial type INTERNAL');
        } else if (serialTypeVarint.value === 11) {
          //console.log('serial type INTERNAL');
        } else if (serialTypeVarint.value >= 12 && serialTypeVarint.value % 2 === 0) {
          //console.log('serial type BLOB', (serialTypeVarint.value - 12) / 2);
        } else if (serialTypeVarint.value >= 13 && serialTypeVarint.value % 2 === 1) {
          //console.log('serial type TEXT', (serialTypeVarint.value - 13) / 2);
        } else {
          throw new Error('Unknown data type - cannot happen');
        }
      }

      // Read payload items corresponding to the serial types
      const payloadDataView = new DataView(dataView.buffer, dataView.byteOffset + cellPointer + lengthVarint.byteLength + rowIdVarint.byteLength + payloadHeaderLengthVarint.byteLength + serialTypesVariantsByteCount, lengthVarint.value - payloadHeaderLengthVarint.value);
      const payload = [];
      let itemOffset = 0;
      for (const serialType of serialTypes) {
        if (serialType === 0) {
          //console.log('payload value NULL');
          payload.push(null);
        } else if (serialType === 1) {
          //console.log('payload value INT 8 bit / 1 byte', payloadDataView.getUint8(itemOffset));
          payload.push(payloadDataView.getUint8(itemOffset));
          itemOffset += 1;
        } else if (serialType === 2) {
          //console.log('payload value INT 16 bit / 2 bytes', payloadDataView.getUint16(itemOffset));
          payload.push(payloadDataView.getUint16(itemOffset));
          itemOffset += 2;
        } else if (serialType === 3) {
          //console.log('payload value INT 24 bit / 3 bytes', payloadDataView.getUint24(itemOffset));
          payload.push(payloadDataView.getUint24(itemOffset));
          itemOffset += 3;
        } else if (serialType === 4) {
          //console.log('payload value INT 32 bit / 4 bytes', payloadDataView.getUint32(itemOffset));
          payload.push(payloadDataView.getUint32(itemOffset));
          itemOffset += 4;
        } else if (serialType === 5) {
          throw new Error('payload value INT 48 bit not implemented');
        } else if (serialType === 6) {
          throw new Error('payload value INT 64 bit not implemented');
        } else if (serialType === 7) {
          //console.log('payload value REAL 64 bit / 8 bytes', payloadDataView.getFloat64(itemOffset));
          payload.push(payloadDataView.getFloat64(itemOffset));
          itemOffset += 4;
        } else if (serialType === 8) {
          //console.log('payload value FALSE');
        } else if (serialType === 9) {
          //console.log('payload value TRUE');
        } else if (serialType === 10) {
          throw new Error('Cannot access internal payload value');
        } else if (serialType === 11) {
          throw new Error('Cannot access internal payload value');
        } else if (serialType >= 12 && serialType % 2 === 0) {
          const length = (serialType - 12) / 2;
          const slice = payloadDataView.buffer.slice(payloadDataView.byteOffset + itemOffset, payloadDataView.byteOffset + itemOffset + length);
          itemOffset += length;
          payload.push('BLOB of ' + slice.byteLength + ' bytes');
        } else if (serialType >= 13 && serialType % 2 === 1) {
          const length = (serialType - 13) / 2;
          const slice = payloadDataView.buffer.slice(payloadDataView.byteOffset + itemOffset, payloadDataView.byteOffset + itemOffset + length);

          // TODO: Document this and also respect the database input encoding actually
          // https://stackoverflow.com/a/17192845/2715716
          let text;
          try {
            text = decodeURIComponent(escape(String.fromCharCode(...new Uint8Array(slice))));
          } catch (error) {
            console.log(String.fromCharCode(...new Uint8Array(slice)));
            text = 'Invalid TEXT.';
          }

          itemOffset += length;
          payload.push(text);
        } else {
          throw new Error('Unknown data type - cannot happen');
        }
      }

      //console.log(rowIdVarint.value, payload);
      this.cells.push({ rowId: rowIdVarint.value, payload });
    }
  }
}
