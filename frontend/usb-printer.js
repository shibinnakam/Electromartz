class USBPrinter {
    constructor() {
        this.device = null;
        this.endpoint = null;
        this.encoder = new TextEncoder();
    }

    async connect() {
        try {
            this.device = await navigator.usb.requestDevice({
                filters: [{}] // Request all devices, user selects the printer
            });

            await this.device.open();
            await this.device.selectConfiguration(1);
            
            // Find the first interface with a bulk OUT endpoint
            const iface = this.device.configuration.interfaces[0];
            await this.device.claimInterface(iface.interfaceNumber);

            const endpoint = iface.alternate.endpoints.find(e => e.direction === 'out' && e.type === 'bulk');
            if (!endpoint) throw new Error("No output endpoint found");
            
            this.endpoint = endpoint.endpointNumber;
            console.log("Printer connected at endpoint:", this.endpoint);
            return true;
        } catch (error) {
            console.error("Connection failed:", error);
            return false;
        }
    }

    async print(data) {
        if (!this.device || !this.endpoint) {
            throw new Error("Printer not connected");
        }
        await this.device.transferOut(this.endpoint, data);
    }

    // ESC/POS Command Generators
    init() { return new Uint8Array([0x1B, 0x40]); }
    alignCenter() { return new Uint8Array([0x1B, 0x61, 0x01]); }
    alignLeft() { return new Uint8Array([0x1B, 0x61, 0x00]); }
    boldOn() { return new Uint8Array([0x1B, 0x45, 0x01]); }
    boldOff() { return new Uint8Array([0x1B, 0x45, 0x00]); }
    text(str) { return this.encoder.encode(str + "\n"); }
    feed(lines = 3) { return new Uint8Array([0x1B, 0x64, lines]); }

    async printReceipt(billData, headerInfo) {
        let commands = [];
        const add = (cmd) => commands.push(cmd);

        add(this.init());
        add(this.alignCenter());
        add(this.boldOn());
        add(this.text("COCHIN BAKERS"));
        add(this.boldOff());
        add(this.text(headerInfo.address));
        add(this.text("Phone: " + headerInfo.phone));
        add(this.text("-------------------------------")); // 32 chars approx for 58mm
        
        add(this.alignLeft());
        billData.items.forEach((item, index) => {
            const line = `${index + 1}. ${item.name}`;
            const priceLine = `   ${item.qty} x ${item.price} = ${item.qty * item.price}`;
            add(this.text(line));
            add(this.text(priceLine));
        });

        add(this.text("-------------------------------"));
        add(this.alignCenter());
        add(this.boldOn());
        add(this.text("Grand Total: Rs." + billData.total));
        add(this.boldOff());
        add(this.text("Status: PAID"));
        add(this.text("Thank you for visiting!"));
        add(this.text("\n"));
        add(this.feed(5));

        // Concatenate all commands into a single Uint8Array
        let totalLength = commands.reduce((acc, curr) => acc + curr.length, 0);
        let combined = new Uint8Array(totalLength);
        let offset = 0;
        for (let cmd of commands) {
            combined.set(cmd, offset);
            offset += cmd.length;
        }

        await this.print(combined);
    }
}

window.usbPrinter = new USBPrinter();
