import React from 'react'
import { Modal, Button, Radio, FormGroup, FormControl, ControlLabel } from 'react-bootstrap'

class ModalFragmentBox extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      peak: null,
      selectedFragment: "",
      newLabelText: "",
      radioChoice: null,
    }
  }

  componentWillReceiveProps(nextProps) {
    this.setState({
      peak: nextProps.peak,
      selectedFragment: (
        nextProps.fragmentMatches.length > 0 ?
        nextProps.fragmentMatches[0].fragment_id : ""
      ),
      radioChoice: (
        nextProps.fragmentMatches.length > 0 ?
        'change' : 'none'
      ),
    })
  }

  radioChange(e) {
    this.setState({
      radioChoice: e.target.value,
    })
  }

  newLabelChange(e) {
    this.setState({
      newLabelText: e.target.value,
    })
  }

  selectedFragmentChange(e) {
    this.setState({
      selectedFragment: e.target.value,
    })
  }

  update() {
    switch (this.state.radioChoice) {
      case "change":
        if (this.props.updateCallback != null) {
          this.props.updateCallback(
            this.state.peak,
            this.state.selectedFragment,
          )
        }
        break

      case "new":
        if (this.props.newLabelCallback != null) {
          this.props.newLabelCallback(
            this.state.peak,
            this.state.newLabelText,
          )
        }
        break

      case "none":
        if (this.props.noneCallback != null) {
          this.props.noneCallback(
            this.state.peak,
          )
        }
        break
    }

    this.close()
  }

  close() {
    if (this.props.closeCallback != null) {
      this.props.closeCallback()
    }
  }

  render() {
    return (
      <Modal
        show={this.props.showModal}
        onHide={this.close.bind(this)}
      >
        <Modal.Header>
          {
            this.props.peak != null &&
            <Modal.Title>
              <div>
                Observed m/z:&nbsp;
                { this.props.peak.mz.toFixed(5) }
              </div>
              {
                this.props.peak.name != null &&
                <div>
                  Current Label:&nbsp;
                  { this.props.peak.name }
                  {
                    this.props.peak.exp_mz != null &&
                    " - " + this.props.peak.exp_mz.toFixed(5)
                  }
                  {
                    this.props.peak.ppm != null &&
                    ' (' + this.props.peak.ppm.toFixed(1) + ' ppm)'
                  }
                </div>
              }
            </Modal.Title>
          }
        </Modal.Header>

        <Modal.Body>
          <FormGroup
            controlId="radioChoice"
          >
            <Radio
              value="change"
              disabled={this.props.fragmentMatches.length <= 0}
              checked={this.state.radioChoice == "change"}
              onChange={this.radioChange.bind(this)}
            >
              <FormGroup
                controlId="fragmentSelect"
              >
                <ControlLabel>
                  Change Label
                </ControlLabel>

                <FormControl
                  componentClass="select"
                  placeholder="select"
                  disabled={this.props.fragmentMatches.length <= 0}
                  value={this.state.selectedFragment}
                  onChange={this.selectedFragmentChange.bind(this)}
                >
                  {
                    this.props.fragmentMatches.map(
                      (object, i) => {
                        return (
                          <option
                            key={i}
                            value={object.fragment_id}
                          >
                            {
                              object.name +
                              ' - ' + object.mz.toFixed(5) +
                              ' (' + object.ppm.toFixed(1) + ' ppm)'
                            }
                          </option>
                        )
                      }
                    )
                  }
                </FormControl>
              </FormGroup>
            </Radio>

            <Radio
              value="new"
              checked={this.state.radioChoice == "new"}
              onChange={this.radioChange.bind(this)}
            >
              <FormGroup
                controlId="newLabelText"
              >
                <ControlLabel>
                  New Label
                </ControlLabel>

                <FormControl
                  type="text"
                  placeholder="Enter text"
                  value={this.state.newLabelText}
                  onChange={this.newLabelChange.bind(this)}
                />
              </FormGroup>
            </Radio>

            <Radio
              value="none"
              checked={this.state.radioChoice == "none"}
              onChange={this.radioChange.bind(this)}
            >
              None
            </Radio>
          </FormGroup>
        </Modal.Body>

        <Modal.Footer>
          <Button
            onClick={this.update.bind(this)}
          >
            Update
          </Button>
          <Button
            onClick={this.close.bind(this)}
          >
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>
    )
  }
}

ModalFragmentBox.propTypes = {
  updateCallback: React.PropTypes.func,
  newLabelCallback: React.PropTypes.func,
  noneCallback: React.PropTypes.func,
  closeCallback: React.PropTypes.func,
}

ModalFragmentBox.defaultProps = {
  updateCallback: null,
  newLabelCallback: null,
  noneCallback: null,
  closeCallback: null,
}

module.exports = ModalFragmentBox
