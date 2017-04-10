import React from 'react'
import PropTypes from 'prop-types'
import { Modal, Button } from 'react-bootstrap'

class ModalBYBox extends React.Component {
  close() {
    if (this.props.closeCallback != null) {
      this.props.closeCallback()
    }
  }

  onClick(peak) {
    if (this.props.clickCallback != null) {
      this.props.clickCallback(peak)
    }
  }

  render() {
    return (
      <Modal
        show={this.props.showModal}
        onHide={this.close.bind(this)}
      >
        <Modal.Header>
          <Modal.Title>
            b/y Ions
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {
            this.props.bIons.length > 0 &&
            (
              <div id="modalBIons">
                {
                  this.props.bIons.map(
                    (peak, index) =>
                    <p key={index}>
                      <a onClick={this.onClick.bind(this, peak)}>
                        {peak.name}
                      </a>
                    </p>
                  )
                }
              </div>
            )
          }
          {
            this.props.yIons.length > 0 &&
            (
              <div id="modalYIons">
                {
                  this.props.yIons.map(
                    (peak, index) =>
                    <p key={index}>
                      <a onClick={this.onClick.bind(this, peak)}>
                        {peak.name}
                      </a>
                    </p>
                  )
                }
              </div>
            )
          }
        </Modal.Body>
        <Modal.Footer>
          <Button
            onClick={this.close.bind(this)}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    )
  }
}

ModalBYBox.propTypes = {
  clickCallback: PropTypes.func,
  closeCallback: PropTypes.func,
  bIons: PropTypes.array,
  yIons: PropTypes.array,
}

ModalBYBox.defaultProps = {
  clickCallback: null,
  closeCallback: null,
  bIons: [],
  yIons: [],
}

module.exports = ModalBYBox
