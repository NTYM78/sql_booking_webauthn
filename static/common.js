const common = {
    apiUrl: "https://sqlbooking.test/api",
    showMessage: function(elementId, message, isError = false) {
        const messageElement = document.getElementById(elementId);
    
        if (!messageElement) {
            console.error('Message element not found');
            return;
        }
    
        messageElement.textContent = message;
        messageElement.style.color = isError ? 'red' : 'green';
    }
}