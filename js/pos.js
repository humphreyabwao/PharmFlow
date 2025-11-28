/**
 * PharmaFlow POS placeholder module
 * Exposes a minimal API surface for future POS work.
 */
(function(window) {
	'use strict';

	const state = {
		cartItems: [],
		activeCustomerId: null
	};

	function init() {
		reset();
		console.info('PharmaFlow POS module initialized. Hook up real POS logic here.');
	}

	function setActiveCustomer(customerId) {
		state.activeCustomerId = customerId || null;
	}

	function addCartItem(item) {
		if (!item) {
			return;
		}
		state.cartItems.push(item);
	}

	function removeCartItem(index) {
		if (index < 0 || index >= state.cartItems.length) {
			return;
		}
		state.cartItems.splice(index, 1);
	}

	function reset() {
		state.cartItems = [];
		state.activeCustomerId = null;
	}

	function getSnapshot() {
		return {
			cartItems: [...state.cartItems],
			activeCustomerId: state.activeCustomerId
		};
	}

	window.PharmaFlowPOS = {
		init,
		setActiveCustomer,
		addCartItem,
		removeCartItem,
		reset,
		getSnapshot
	};
})(window);
