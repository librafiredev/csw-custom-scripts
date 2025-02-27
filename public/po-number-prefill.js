// public/po-number-prefill.js
(function () {
    console.log('PO Number Prefill script loaded');

    // Function to find and fill the PO Number field
    function fillPONumberField() {
        // Only run on checkout pages
        if (!window.location.href.includes('/checkout')) return false;

        // Get cart data including the note
        fetch('/cart.js')
            .then(response => response.json())
            .then(cart => {
                // Check if we have a cart note (which contains the PO number)
                if (cart.note) {
                    const poNumber = cart.note;
                    console.log('Found PO number in cart note:', poNumber);

                    // Find the PO Number field
                    const poField = document.querySelector('input[id="TextField0"][placeholder="PO Number"][name="poNumber"]');

                    if (poField) {
                        console.log('Found PO Number field, filling with:', poNumber);
                        poField.value = poNumber;
                        poField.dispatchEvent(new Event('input', { bubbles: true }));
                        poField.dispatchEvent(new Event('change', { bubbles: true }));
                        return true;
                    } else {
                        console.log('PO Number field not found yet, will retry');
                        return false;
                    }
                } else {
                    console.log('No PO number found in cart note');
                }
            })
            .catch(error => console.error('Error fetching cart:', error));

        return false;
    }

    // Try to fill immediately
    if (!fillPONumberField()) {
        // Try again after delays
        setTimeout(fillPONumberField, 1000);
        setTimeout(fillPONumberField, 2000);
        setTimeout(fillPONumberField, 3000);
    }

    // Watch for DOM changes
    const observer = new MutationObserver(function () {
        fillPONumberField();
    });

    observer.observe(document.body, { childList: true, subtree: true });
})();