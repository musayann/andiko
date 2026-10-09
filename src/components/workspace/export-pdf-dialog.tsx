"use client"

import { LoaderCircleIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { downloadPdf, type PaperSize } from "@/lib/export"

interface ExportPdfDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  content: string
  title: string
}

export function ExportPdfDialog({ open, onOpenChange, content, title }: ExportPdfDialogProps) {
  const [paper, setPaper] = useState<PaperSize>("a4")
  const [pageNumbers, setPageNumbers] = useState(true)
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      await downloadPdf(content, title, { paper, pageNumbers })
      toast.success("PDF exported")
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "PDF export failed")
    } finally {
      setExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !exporting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Export PDF</DialogTitle>
          <DialogDescription>
            Downloads “{title}” as a PDF with selectable text. The document is sent to our server to create the PDF,
            and isn’t kept there.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="pdf-paper">Paper size</Label>
            <Select value={paper} onValueChange={(value) => setPaper(value as PaperSize)}>
              <SelectTrigger id="pdf-paper" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="a4">A4</SelectItem>
                <SelectItem value="letter">US Letter</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="pdf-page-numbers"
              checked={pageNumbers}
              onCheckedChange={(checked) => setPageNumbers(checked === true)}
            />
            <Label htmlFor="pdf-page-numbers" className="font-normal">
              Page numbers in footer
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={exporting}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={exporting}>
            {exporting && <LoaderCircleIcon className="animate-spin" />}
            {exporting ? "Exporting…" : "Export"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
