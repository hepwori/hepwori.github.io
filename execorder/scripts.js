$(function() {
    $("#btnSave").click(function() {
        html2canvas($("#image"), {
            "allowTaint": true,
            logging: true,
            onrendered: function(canvas) {
                // theCanvas = canvas;
                // console.log(canvas)
                var url = canvas.toDataURL("image/png");
                window.open(url, "_blank");
            }
        });
    });
});
