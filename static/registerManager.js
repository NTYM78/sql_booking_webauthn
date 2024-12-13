const registerManagerButton = document.getElementById('registerManagerButton')
if (registerManagerButton) {
    registerManagerButton.addEventListener('click', registerManager)
}

async function registerManager() {
    const username = document.getElementById('managerUsername').value
    const icNum = document.getElementById('bindManagerIC').value 
    const passPhrase = document.getElementById('passPhrase').value

    try {
        const bindResponse = await fetch (`${common.apiUrl}/user/getUserID`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({icNum, passPhrase, "isManager": 1})
        })

        if (!bindResponse.ok) {
            const msg = await bindResponse.json();
            throw new Error(msg);
        } else {
            common.showMessage('message', "", false);
            common.showMessage('bindmessage', 'Manager IC found and bindable', false)
            common.showMessage('passphrasemessage', 'Passphrase is correct', false)
        }
    } catch (error) {
        common.showMessage('message', 'Error: ' + error.message, true)
        return
    }

    try {
        const response = await fetch(`${common.apiUrl}/user/register/begin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });

        if (!response.ok) {
            const msg = await response.json();
            throw new Error('User already exists or failed to get registration options from server: ' + msg);
        }

        const { options, session_id } = await response.json();

        // Start WebAuthn registration with modified options
        const attestationResponse = await SimpleWebAuthnBrowser.startRegistration(options.publicKey);

        // Send attestation response to server
        const verificationResponse = await fetch(`${common.apiUrl}/user/register/finish?session_id=${session_id}&ic=${icNum}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(attestationResponse)
        });

        const msg = await verificationResponse.json();
        if (verificationResponse.ok) {
            common.showMessage("message", "Registration successful: " + msg.message, false);
        } else {
            common.showMessage("message", "Registration failed: " + msg.message, true);
        }
    } catch (error) {
        common.showMessage("message" ,'Error: ' + error.message, true);
    }
}
