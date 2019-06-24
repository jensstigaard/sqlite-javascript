window.addEventListener('load', async () => {
  let fileName;
  let sqlite;
  let selectedTable;
  const pageSize = 25;
  let selectedPage = 0;

  function renderTables() {
    const tablesDiv = document.getElementById('tablesDiv');
    tablesDiv.innerHTML = '';

    const loadLocalButton = document.createElement('button');
    loadLocalButton.textContent = 'Open file';
    loadLocalButton.addEventListener('click', () => {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.addEventListener('change', async () => {
        if (fileInput.files.length === 0) {
          return;
        }

        const file = fileInput.files[0];
        fileName = file.name;

        const fileReader = new FileReader();
        fileReader.readAsArrayBuffer(file);
        fileReader.addEventListener('load', () => {
          const dataView = new DataView(fileReader.result);
          sqlite = new Sqlite(dataView);
          selectedTable = sqlite.getTables().next().value;
          renderTables();
          renderCells();
        });

        fileReader.addEventListener('error', () => {
          alert('Failed to read the file');
        });
      });

      fileInput.click();
    });

    const loadRemoteButton = document.createElement('button');
    loadRemoteButton.textContent = 'Load from URL';
    loadRemoteButton.addEventListener('click', async () => {
      const url = prompt('URL:', 'Chinook_Sqlite.sqlite');
      if (!url) {
        return;
      }

      fileName = url;
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const dataView = new DataView(arrayBuffer);
      sqlite = new Sqlite(dataView);
      selectedTable = sqlite.getTables().next().value;
      renderTables();
      renderCells();
    });

    tablesDiv.append(loadLocalButton, loadRemoteButton, document.createElement('hr'));

    if (sqlite) {
      const databaseSpan = document.createElement('span');
      databaseSpan.textContent = fileName;
      tablesDiv.append(databaseSpan);

      for (const table of sqlite.getTables()) {
        const tableButton = document.createElement('button');
        tableButton.textContent = table;
        tableButton.dataset.tableName = table;
        tableButton.className = selectedTable === table ? 'selected item' : 'item';
        tableButton.addEventListener('click', handleSelectTableButtonClick)
        tablesDiv.append(tableButton);
      }
    } else {
      const infoP = document.createElement('p');
      infoP.textContent = 'Click one of the buttons above to open a SQLite database. The URL is prefilled with an example.';
      tablesDiv.append(infoP);
    }

    const markedA = document.createElement('a');
    markedA.textContent = 'Marked SQLite viewer';
    markedA.href = 'marked';

    const markedP = document.createElement('p');
    markedP.textContent = 'A binary view of a given page\'s contents with cell annotations';

    const graphedA = document.createElement('a');
    graphedA.textContent = 'Graphed SQLite viewer';
    graphedA.href = 'graphed';

    const graphedP = document.createElement('p');
    graphedP.textContent = 'A visual view of relationships between the database\'s b-tree pages';

    tablesDiv.append(document.createElement('hr'), markedA, markedP, graphedA, graphedP);
  }

  function handleSelectTableButtonClick(event) {
    selectedTable = event.currentTarget.dataset.tableName;
    selectedPage = 0;
    renderTables();
    renderCells(selectedTable);
  }

  function renderCells() {
    if (!selectedTable) {
      return;
    }

    const cellsDiv = document.getElementById('cellsDiv');
    cellsDiv.innerHTML = '';

    const rows = [...sqlite.getRows(selectedTable)];
    const pages = Math.ceil(rows.length / pageSize);

    const pagerDiv = document.createElement('div');

    if (rows.length > 0) {
      const prevButton = document.createElement('button');
      prevButton.textContent = '<';
      prevButton.disabled = selectedPage === 0;
      prevButton.addEventListener('click', handlePrevButtonClick);
      pagerDiv.append(prevButton);

      const nextButton = document.createElement('button');
      nextButton.textContent = '>';
      nextButton.disabled = selectedPage === pages - 1;
      nextButton.addEventListener('click', handleNextButtonClick);
      pagerDiv.append(nextButton);
    }

    if (rows.length === 0) {
      pagerDiv.append(document.createTextNode(' The table is empty.'));
    } else {
      pagerDiv.append(document.createTextNode(` Page #${selectedPage + 1} out of ${pages} pages (of ${pageSize} items each). ${rows.length} items total.`));
    }

    cellsDiv.append(pagerDiv);

    const table = document.createElement('table');

    const thead = document.createElement('thead');
    table.append(thead);

    let tr = document.createElement('tr');
    thead.append(tr);

    const th = document.createElement('th');
    th.textContent = 'Row ID';
    tr.append(th);

    const columns = [...sqlite.getColumns(selectedTable)];
    for (const column of columns) {
      const th = document.createElement('th');
      th.textContent = column.name;
      th.title = column.type;
      tr.append(th);
    }

    const tbody = document.createElement('tbody');
    table.append(tbody);

    const page = rows.slice(selectedPage * pageSize, selectedPage * pageSize + pageSize);
    for (const row of page) {
      const tr = document.createElement('tr');
      tbody.append(tr);

      // Note that 0 is the RowID preudo-cell
      tr.id = row[0];

      for (let index = 0; index < row.length; index++) {
        const cell = row[index];

        const column = index > 0 && columns[index - 1];
        if (cell && column && column.name.endsWith('Id')) {
          const td = document.createElement('td');

          const referenceButton = document.createElement('button');
          referenceButton.textContent = cell;
          referenceButton.dataset.tableName = column.name.substring(0, column.name.length - 2);
          referenceButton.dataset.rowId = cell;
          referenceButton.addEventListener('click', handleNavigateToReferenceButtonClick);
          td.append(referenceButton);

          tr.append(td);
        } else {
          const td = document.createElement('td');
          td.textContent = cell;
          tr.append(td);
        }
      }
    }

    cellsDiv.append(table);
  }

  renderTables();

  function handleNavigateToReferenceButtonClick(event) {
    selectedTable = event.currentTarget.dataset.tableName;
    selectedPage = 0;
    renderTables();
    renderCells();

    location.href = '#' + event.currentTarget.dataset.rowId;
  }

  function handlePrevButtonClick() {
    if (selectedPage === 0) {
      return;
    }

    selectedPage--;
    renderCells();
  }

  function handleNextButtonClick() {
    const rows = [...sqlite.getRows(selectedTable)];
    const pages = Math.ceil(rows.length / pageSize);
    if (selectedPage === pages - 1) {
      return;
    }

    selectedPage++;
    renderCells();
  }
});
