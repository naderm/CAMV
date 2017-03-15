import React from 'react'
import { Button } from 'react-bootstrap'

import fs from 'fs'
import path from 'path'
import zlib from 'zlib'

import domtoimage from 'dom-to-image'
import JSONStream from 'JSONStream'
import update from 'react-addons-update'
const remote = require('electron').remote
const { dialog } = require('electron').remote

import ModalExportBox from './ModalExportBox'
import ModalImportBox from './ModalImportBox'
import ModalFragmentBox from './ModalFragmentBox'
import PrecursorSpectrumBox from './PrecursorSpectrumBox'
import QuantSpectrumBox from './QuantSpectrumBox'
import ScanDataBox from './ScanDataBox'
import ScanSelectionList from './ScanSelectionList'
import SequenceBox from './SequenceBox'
import SpectrumBox from './SpectrumBox'

import { saveCAMV } from '../io/camv.jsx'
import { exportCSV } from '../io/csv.jsx'
import { spectraToImage } from '../io/spectra.jsx'


class ViewBox extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      /* Unused */
      selectedRun: null,
      selectedSearch: null,

      modalImportOpen: true,
      exporting: false,

      /* Selected PTM / Scan / Peptide / Protein */
      selectedProtein: null,
      selectedPeptide: null,
      selectedScan: null,
      selectedPTMPlacement: null,

      /* Spectrum interface states */
      minMZ: 0,
      maxMZ: null,

      /* Peak labeling states */
      selectedMz: null,
      currentLabel: null,
      fragmentMatches: [],
      maxPPM: 100,  /* Max window for fragments that can be candidates */

      /* Modal Windows */
      modalFragmentSelectionOpen: false,
      modalExportOpen: false,

      /* Validatoin data */
      scanData: [],
      peptideData: [],
      basename: null,
    }
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevState.selectedRun != this.state.selectedRun) {
      // console.log('New run: ' + this.state.selectedRun)
    }
    if (prevState.selectedSearch != this.state.selectedSearch) {
      // console.log('New search: ' + this.state.selectedSearch)
    }
  }

  updateSelectedProtein(proteinId) {
    this.setState({
      selectedProtein: proteinId,
    })
  }

  updateSelectedPeptide(peptideId) {
    this.setState({
      selectedPeptide: peptideId,
    })
  }

  updateSelectedScan(scanId) {
    this.setState({
      selectedScan: scanId,
      minMZ: 0,
      maxMZ: null,
    })
  }

  updateSelectedPTMPlacement(modsId) {
    this.setState({
      selectedPTMPlacement: modsId,
    })
  }

  updateAll(proteinId, peptideId, scanId, modsId) {
    this.setState({
      selectedProtein: proteinId,
      selectedPeptide: peptideId,
      selectedScan: scanId,
      selectedPTMPlacement: modsId,
      minMZ: 0,
      maxMZ: null,
    })

    if ((modsId != null) || [proteinId, peptideId, scanId, modsId].every(i => i != null)) {
      this.redrawCharts()
    }
  }

  redrawCharts() {
    this.refs["fragmentSpectrum"].drawChart();
    this.refs["precursorSpectrum"].drawChart();
    this.refs["quantSpectrum"].drawChart();
  }

  getScanData() {
    if (this.state.selectedProtein != null) {
      let protein = this.state.scanData[this.state.selectedProtein]

      if (this.state.selectedPeptide != null) {
        let peptide = protein.peptides[this.state.selectedPeptide]

        if (this.state.selectedScan != null) {
          let scan = peptide.scans[this.state.selectedScan]

          return scan.scanData
        }
      }
    }
    return null
  }

  updateMinMZ(newMinMZ) {
    this.setState({
      minMZ: newMinMZ > 0 ? newMinMZ : 0,
    })
  }

  updateMaxMZ(newMaxMZ) {
    let scanData = this.getScanData()
    let max_mz = Math.ceil(
      (scanData != null) ? scanData[scanData.length - 1].mz + 1 : 100
    )
    this.setState({
      maxMZ: newMaxMZ < max_mz ? newMaxMZ : max_mz,
    })
  }

  updateSelectedMz(mz) {
    let data = this.state.scanData[this.state.selectedProtein]
      .peptides[this.state.selectedPeptide]
      .scans[this.state.selectedScan]
      .scanData
    let peptide = this.state.scanData[this.state.selectedProtein]
      .peptides[this.state.selectedPeptide]
    let peptideDataId = peptide.peptideDataId
    let modificationStateId = peptide.modificationStateId
    let scan = peptide.scans[this.state.selectedScan]

    if (
      peptideDataId == null ||
      modificationStateId == null ||
      this.state.selectedPTMPlacement == null
    ) {
      return;
    }

    let matchData = this.state.peptideData[peptideDataId]
      .modificationStates[modificationStateId]
      .mods[this.state.selectedPTMPlacement]
      .matchData

    let currentLabel = ''

    let matchId = data.find(
      peak => peak.mz === mz
    ).matchInfo[this.state.selectedPTMPlacement].matchId

    if (matchId !== null) { currentLabel = matchData[matchId].name }

    let matches = matchData.filter(
      (item) => {
        item.ppm = 1e6 * Math.abs(item.mz - mz) / mz
        return item.ppm < this.state.maxPPM
      }
    )

    this.setState({
      selectedMz: mz,
      modalFragmentSelectionOpen: true,
      fragmentMatches: matches,
      currentLabel: currentLabel
    })
  }

  closeFragmentSelectionModal() {
    this.setState({
      modalFragmentSelectionOpen: false,
      fragmentMatches: [],
      selectedMz: null,
      currentLabel: ''
    })
  }

  updateSelectedFragment(matchId) {
    if (
      this.state.selectedProtein == null ||
      this.state.selectedPeptide == null ||
      this.state.selectedScan == null ||
      this.state.selectedMz == null
    ) {
        return
    }

    let peak_targets = {}

    let peptide = this.state.scanData[this.state.selectedProtein]
      .peptides[this.state.selectedPeptide]

    let matchData = this.state.peptideData[peptide.peptideDataId]
      .modificationStates[peptide.modificationStateId]
      .mods[this.state.selectedPTMPlacement]
      .matchData

    let scanData = this.state.scanData[this.state.selectedProtein]
      .peptides[this.state.selectedPeptide]
      .scans[this.state.selectedScan]
      .scanData

    scanData.forEach(
      function(peak, index) {
        if (peak.mz === this.state.selectedMz) {
          let match_id_target = {matchId: {$set: matchId}}
          let ptm_target = {}
          ptm_target[this.state.selectedPTMPlacement] = match_id_target
          let match_info_target = {matchInfo: ptm_target}
          peak_targets[index] = match_info_target
          peak.matchInfo[this.state.selectedPTMPlacement].matchId = matchId

          this.setState({
            currentLabel: matchData[matchId].name
          })
        }
      }.bind(this)
    )

    let scan_data_target = {scanData: peak_targets}
    let scan_target = {}
    scan_target[this.state.selectedScan] = scan_data_target;
    let scans_target = {scans: scan_target};
    let peptide_target = {}
    peptide_target[this.state.selectedPeptide] = scans_target;
    let peptides_target = {peptides: peptide_target};
    let protein_target = {}
    protein_target[this.state.selectedProtein] = peptides_target;

    this.setState({
      scanData: update(this.state.scanData, protein_target)
    })
  }

  closeImportModal() {
    this.setState({
      modalImportOpen: false,
    })
  }

  closeExportModal() {
    this.setState({
      modalExportOpen: false,
    })
  }

  *iterate_spectra(export_spectras) {
    while (export_spectras.length < 4) {
      export_spectras.push(false);
    }

    for (let protein of this.state.scanData) {
      for (let peptide of protein.peptides) {
        for (let scan of peptide.scans) {
          for (let match of scan.choiceData) {
            let state = match.state

            if (
              (state == "accept" && !export_spectras[0]) ||
              (state == "maybe" && !export_spectras[1]) ||
              (state == "reject" && !export_spectras[2]) ||
              (state == null && !export_spectras[3])
            ) {
              continue;
            }

            let nodes = [
              protein.proteinId,
              peptide.peptideId,
              scan.scanId,
              match.modsId,
            ];
            let mod = this.state.peptideData[peptide.peptideDataId]
              .modificationStates[peptide.modificationStateId]
              .mods[match.modsId]
            yield [
              nodes,
              protein.proteinName,
              mod != null ? mod.name : '',
              scan.scanNumber,
              state,
            ];
          }
        }
      }
    }
  }

  runExport(dirName, export_spectras, exportTables) {
    this.setState({
      modalExportOpen: false,
    })

    if (exportTables || export_spectras.some(i => i)) {
      fs.mkdir(
        dirName,
        function() {
          if (exportTables) {
            exportCSV(
              this,
              path.join(dirName, this.state.basename + ".csv")
            );
          }

          if (!export_spectras.some(i => i)) {
            return;
          }

          spectraToImage(this, dirName, export_spectras)
        }.bind(this)
      )
    }
  }

  updateChoice(choice) {
    /* Messy solution because javascript doesn't allow variables as dict keys */
    let state_target = {state: {$set: choice}};
    let ptm_target = {};
    ptm_target[this.state.selectedPTMPlacement] = state_target;
    let choice_target = {choiceData: ptm_target};
    let scan_target = {}
    scan_target[this.state.selectedScan] = choice_target;
    let scans_target = {scans: scan_target};
    let peptide_target = {}
    peptide_target[this.state.selectedPeptide] = scans_target;
    let peptides_target = {peptides: peptide_target};
    let protein_target = {}
    protein_target[this.state.selectedProtein] = peptides_target;

    /* However, doing it this way keeps from cloning data, saving a lot of time
       on large files.
     */
    this.setState({
      scanData: update(this.state.scanData, protein_target)
    })
  }

  openImport() {
    this.setState({
      modalImportOpen: true,
    })
  }

  setScanData(scanData) {
    this.setState({
      scanData: scanData,
    })
  }

  setPeptideData(peptideData) {
    this.setState({
      peptideData: peptideData,
    })
  }

  runImport(fileName) {
    this.setState({
      modalImportOpen: false,
    })

    if (fileName != null && fileName.length > 0) {
      this.setState({
        basename: fileName.split(/(\\|\/)/g).pop().split('.')[0],
      })
      this.refs["modalExportBox"].setState({
        exportDirectory: fileName.match(/(.*)[\/\\]/)[1] || '',
        dirChosen: true,
      })
    }
  }

  openExport() {
    this.setState({
      modalExportOpen: true,
    })
  }

  save() {
    dialog.showSaveDialog(
      {
        filters: [
          {
            name: 'JSON',
            extensions: ['camv', 'camv.gz']
          },
        ]
      },
      function(fileName) {
        if (fileName === undefined)
          return;

        saveCAMV(
          fileName,
          this.state.scanData,
          this.state.peptideData
        )
      }.bind(this)
    );
  }

  render() {
    let spectrumData = []
    let precursorSpectrumData = []
    let precursorMz = null
    let isolationWindow = null
    let quantSpectrumData = []
    let quantMz = null
    let chargeState = null
    let matchData = []
    let bFound = []
    let yFound = []
    let peptideSequence = null
    let inputDisabled = true
    let protName = null
    let scanNumber = null
    let fileName = null
    let collisionType = null
    let c13Num = 0

    if (this.state.selectedProtein != null) {
      let protein = this.state.scanData[this.state.selectedProtein]

      if (this.state.selectedPeptide != null) {
        let peptide = protein.peptides[this.state.selectedPeptide]

        if (this.state.selectedScan != null) {
          let scan = peptide.scans[this.state.selectedScan]

          spectrumData = scan.scanData
          precursorSpectrumData = scan.precursorScanData
          precursorMz = scan.precursorMz
          isolationWindow = scan.precursorIsolationWindow
          chargeState = scan.chargeState
          quantSpectrumData = scan.quantScanData
          quantMz = scan.quantMz
          protName = protein.proteinName
          scanNumber = scan.scanNumber
          fileName = scan.fileName
          collisionType = scan.collisionType
          c13Num = scan.c13Num

          if (this.state.selectedPTMPlacement != null) {
            inputDisabled = false
            let mod = this.state.peptideData[peptide.peptideDataId]
              .modificationStates[peptide.modificationStateId]
              .mods[this.state.selectedPTMPlacement]
            matchData = mod.matchData
            peptideSequence = mod.name

            spectrumData.forEach(function(peak) {
              var matchId = peak.matchInfo[this.state.selectedPTMPlacement]
                .matchId

              if (matchId) {
                if (matchData[matchId].ionType == 'b') {
                  bFound.push(matchData[matchId].ionPosition)
                } else if (matchData[matchId].ionType == 'y') {
                  yFound.push(matchData[matchId].ionPosition)
                }
              }
            }.bind(this))
          }
        }
      }
    }

    return (
      <div
        className="panel panel-default"
        id="viewBox"
        style={{margin: this.state.exporting ? '0px' : '10px'}}
      >
        <ModalFragmentBox
          ref="modalFragmentBox"
          showModal={this.state.modalFragmentSelectionOpen}
          mz={this.state.selectedMz}
          fragmentMatches={this.state.fragmentMatches}
          currentLabel={this.state.currentLabel}
          updateCallback={this.updateSelectedFragment.bind(this)}
          closeCallback={this.closeFragmentSelectionModal.bind(this)}
        />
        <ModalImportBox
          ref="modalImportBox"
          showModal={this.state.modalImportOpen}
          setPeptideData={this.setPeptideData.bind(this)}
          setScanData={this.setScanData.bind(this)}
          importCallback={this.runImport.bind(this)}
          closeCallback={this.closeImportModal.bind(this)}
        />
        <ModalExportBox
          ref="modalExportBox"
          showModal={this.state.modalExportOpen}
          closeCallback={this.closeExportModal.bind(this)}
          exportCallback={this.runExport.bind(this)}
        />
        <div
          className="panel panel-default"
          id="scanSelectionList"
          style={{display: this.state.exporting ? 'none' : null}}
        >
          <ScanSelectionList
            ref="scanSelectionList"
            scanData={this.state.scanData}
            peptideData={this.state.peptideData}
            updateSelectedProteinCallback={this.updateSelectedProtein.bind(this)}
            updateSelectedPeptideCallback={this.updateSelectedPeptide.bind(this)}
            updateSelectedScanCallback={this.updateSelectedScan.bind(this)}
            updateSelectedPTMPlacementCallback={this.updateSelectedPTMPlacement.bind(this)}
            updateAllCallback={this.updateAll.bind(this)}
            selectedProtein={this.state.selectedProtein}
            selectedPeptide={this.state.selectedPeptide}
            selectedScan={this.state.selectedScan}
            selectedPTMPlacement={this.state.selectedPTMPlacement}
          />
        </div>
        <div
          id="sequenceSpectraContainer"
          style={{width: this.state.exporting ? "100%" : "80%"}}
        >
          <div
            className="panel panel-default"
            id="sequenceBox"
          >
            <div
              id="scanDataContainer"
            >
              <ScanDataBox
                protName={protName}
                chargeState={chargeState}
                scanNumber={scanNumber}
                fileName={fileName}
              />
            </div>
            <div
              id="sequenceContainer"
            >
              <SequenceBox
                bFound={bFound}
                sequence={peptideSequence}
                yFound={yFound}
              />
            </div>
          </div>
          <div
            className="panel panel-default"
            id="spectra"
          >
            <div
              id="precursorQuantContainer"
            >
              <div
                id="precursorSpectrumBox"
                style={{
                  height: this.state.exporting ? "50%" : "46.25%",
                  width: this.state.exporting ? "95%" : "100%"
                }}
              >
                <PrecursorSpectrumBox
                  ref="precursorSpectrum"
                  spectrumData={precursorSpectrumData}
                  precursorMz={precursorMz}
                  isolationWindow={isolationWindow}
                  c13Num={c13Num}
                  chargeState={chargeState}
                  ppm={50}
                />
              </div>
              <div
                id="quantSpectrumBox"
                style={{
                  height: this.state.exporting ? "50%" : "46.25%",
                  width: this.state.exporting ? "95%" : "100%"
                }}
              >
                <QuantSpectrumBox
                  ref="quantSpectrum"
                  spectrumData={quantSpectrumData}
                  quantMz={quantMz}
                  ppm={50}
                />
              </div>
              <div id="exportSave">
                <Button
                  id="openImport"
                  onClick={this.openImport.bind(this)}
                  style={{display: this.state.exporting ? 'none' : null}}
                  disabled={this.state.scanData.length > 0}
                >
                  Open
                </Button>
                <Button
                  id="openSave"
                  onClick={this.save.bind(this)}
                  style={{display: this.state.exporting ? 'none' : null}}
                  disabled={this.state.scanData.length < 1}
                >
                  Save
                </Button>
                <Button
                  id="openExport"
                  onClick={this.openExport.bind(this)}
                  style={{display: this.state.exporting ? 'none' : null}}
                  disabled={this.state.scanData.length < 1}
                >
                  Export
                </Button>
              </div>
            </div>
            <div
              id="fragmentSpectrumBox"
            >
              <SpectrumBox
                ref="fragmentSpectrum"
                spectrumData={spectrumData}
                minMZ={this.state.minMZ}
                maxMZ={this.state.maxMZ}
                updateMinMZ={this.updateMinMZ.bind(this)}
                updateMaxMZ={this.updateMaxMZ.bind(this)}
                collisionType={collisionType}
                inputDisabled={inputDisabled}
                matchData={matchData}
                selectedPTMPlacement={this.state.selectedPTMPlacement}
                updateChoice={this.updateChoice.bind(this)}
                pointChosenCallback={this.updateSelectedMz.bind(this)}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }
}

module.exports = ViewBox
