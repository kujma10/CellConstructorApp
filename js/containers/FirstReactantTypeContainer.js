import React from "react";
import Dropdown from '../components/Dropdown';

import { updateFirstReactantType } from '../actions';
import { connect } from 'react-redux'

const mapStateToProps = (state) => {
  return {
    selectedValue: state.currentReaction.firstReactant.type,
    values: state.types
  }
};

const mapDispatchToProps = (dispatch) => {
  return {
    onSelected: (value) => dispatch(updateFirstReactantType(value))
  }
};

export default connect(mapStateToProps, mapDispatchToProps)(Dropdown);