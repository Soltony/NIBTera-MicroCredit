
'use client';

import React, { useState } from 'react';
import ExcelJS from 'exceljs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Briefcase, Home, PersonStanding, type LucideIcon, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LoanProduct } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface AddProductDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAddProduct: (product: Omit<LoanProduct, 'id' | 'status' | 'serviceFee' | 'dailyFee' | 'penaltyRules' | 'providerId' >) => void;
}

const icons: { name: string; component: LucideIcon }[] = [
  { name: 'PersonStanding', component: PersonStanding },
  { name: 'Home', component: Home },
  { name: 'Briefcase', component: Briefcase },
];

export function AddProductDialog({ isOpen, onClose, onAddProduct }: AddProductDialogProps) {
  const [productName, setProductName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIconName, setSelectedIconName] = useState(icons[0].name);
  const [minLoan, setMinLoan] = useState('');
  const [maxLoan, setMaxLoan] = useState('');
  const [duration, setDuration] = useState('30');
  const [isSalaryAdvance, setIsSalaryAdvance] = useState(false);
  const [advancePercent, setAdvancePercent] = useState('');
  const [installments, setInstallments] = useState('');
  const [salaryFile, setSalaryFile] = useState<File | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleCustomIconUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && (file.type === 'image/svg+xml' || file.type === 'image/png' || file.type === 'image/jpeg')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setSelectedIconName(result);
      };
      reader.readAsDataURL(file);
    } else {
      alert('Please select an SVG, PNG, or JPG file.');
    }
  };

  const handleSelectIcon = (name: string) => {
    setSelectedIconName(name);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (productName.trim() === '') return;

    const parsedDuration = parseInt(duration);
    const parsedInstallments = installments === '' ? null : Number(installments);
    const computedIntervalDays = (isSalaryAdvance && parsedInstallments && parsedInstallments > 0 && (isNaN(parsedDuration) ? 0 : parsedDuration) > 0)
      ? Math.floor((isNaN(parsedDuration) ? 0 : parsedDuration) / parsedInstallments)
      : null;

    if (isSalaryAdvance) {
      if (!parsedInstallments || !Number.isFinite(parsedInstallments) || parsedInstallments <= 0) return;
    }
    // parse salary CSV if provided
    let salaryMappingsJson: string | undefined = undefined;
    if (isSalaryAdvance && salaryFile) {
      const ext = (salaryFile.name || '').split('.').pop()?.toLowerCase();
      if (ext === 'xlsx' || ext === 'xls') {
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const buffer = reader.result as ArrayBuffer;
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(buffer);
            const sheet = workbook.worksheets[0];
            const mappingsArr: any[] = [];
            if (sheet) {
              const headerRow = sheet.getRow(1).values as any[];
              const rawHeaders = (headerRow || []).slice(1).map((h: any) => String(h || '').trim());
              const canonicalHeaders = rawHeaders.map(h => {
                const norm = String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                if (norm.includes('account') || norm.includes('acct')) return 'accountNumber';
                if (norm.includes('salary') || norm.includes('amount') || norm.includes('pay')) return 'salary';
                return norm || h;
              });
              for (let i = 2; i <= sheet.rowCount; i++) {
                const row = sheet.getRow(i).values as any[];
                if (!row || row.length <= 1) continue;
                const data: any = {};
                canonicalHeaders.forEach((h: string, idx: number) => {
                  data[h] = row[idx + 1] ?? '';
                });
                mappingsArr.push({
                  accountNumber: String(data.accountNumber || '').trim(),
                  salary: Number(data.salary || 0)
                });
              }
            }
            salaryMappingsJson = JSON.stringify(mappingsArr.filter(m => m.accountNumber));
          } catch (err) {
            console.error('Failed to parse Excel file', err);
          }

          // The parent component will add the providerId
          onAddProduct({
            name: productName,
            description,
            icon: selectedIconName,
            minLoan: isSalaryAdvance ? 0 : (parseFloat(minLoan) || 0),
            maxLoan: isSalaryAdvance ? 0 : (parseFloat(maxLoan) || 0),
            duration: isNaN(parsedDuration) ? 30 : parsedDuration,
            isSalaryAdvance,
            advancePercent: isSalaryAdvance ? (advancePercent ? Number(advancePercent) : null) : null,
            salaryAdvanceMappings: isSalaryAdvance ? salaryMappingsJson : undefined,
            installments: isSalaryAdvance ? parsedInstallments : null,
            repaymentIntervalDays: isSalaryAdvance ? computedIntervalDays : null,
            penaltyPerInstallment: isSalaryAdvance ? true : null,
          } as any);

          // Reset form
          setProductName('');
          setDescription('');
          setSelectedIconName(icons[0].name);
          setMinLoan('');
          setMaxLoan('');
          setDuration('30');
          setIsSalaryAdvance(false);
          setAdvancePercent('');
          setInstallments('');
          setSalaryFile(null);

          onClose();
        };
        reader.readAsArrayBuffer(salaryFile);
        return;
      }

      // fallback to CSV text parsing
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result || '');
        const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
        if (lines.length) {
          const headers = lines[0].split(',').map(h => h.trim());
          const rows = lines.slice(1).map(line => {
            const cols = line.split(',');
            const obj: any = {};
            headers.forEach((h, i) => obj[h] = cols[i] ? cols[i].trim() : '');
            return obj;
          });
          const mappings = rows.map((r: any) => ({
            accountNumber: String(r.accountNumber || r.account || r.acct || r.account_no || ''),
            salary: Number(r.salary || r.Salary || r.amount || 0)
          })).filter((r: any) => r.accountNumber);
          salaryMappingsJson = JSON.stringify(mappings);
        }

        // The parent component will add the providerId
        onAddProduct({
          name: productName,
          description,
          icon: selectedIconName,
          minLoan: isSalaryAdvance ? 0 : (parseFloat(minLoan) || 0),
          maxLoan: isSalaryAdvance ? 0 : (parseFloat(maxLoan) || 0),
          duration: isNaN(parsedDuration) ? 30 : parsedDuration,
          isSalaryAdvance,
          advancePercent: isSalaryAdvance ? (advancePercent ? Number(advancePercent) : null) : null,
          salaryAdvanceMappings: isSalaryAdvance ? salaryMappingsJson : undefined,
          installments: isSalaryAdvance ? parsedInstallments : null,
          repaymentIntervalDays: isSalaryAdvance ? computedIntervalDays : null,
          penaltyPerInstallment: isSalaryAdvance ? true : null,
        } as any);

        // Reset form
        setProductName('');
        setDescription('');
        setSelectedIconName(icons[0].name);
        setMinLoan('');
        setMaxLoan('');
        setDuration('30');
        setIsSalaryAdvance(false);
        setAdvancePercent('');
        setInstallments('');
        setSalaryFile(null);

        onClose();
      };
      reader.readAsText(salaryFile);
      return;
    }

    // The parent component will add the providerId
    onAddProduct({
      name: productName,
      description,
      icon: selectedIconName,
      minLoan: parseFloat(minLoan) || 0,
      maxLoan: parseFloat(maxLoan) || 0,
      duration: isNaN(parsedDuration) ? 30 : parsedDuration,
      isSalaryAdvance,
      advancePercent: isSalaryAdvance ? (advancePercent ? Number(advancePercent) : null) : null,
      salaryAdvanceMappings: undefined,
      installments: isSalaryAdvance ? parsedInstallments : null,
      repaymentIntervalDays: isSalaryAdvance ? computedIntervalDays : null,
      penaltyPerInstallment: isSalaryAdvance ? true : null,
    } as any);
    
    // Reset form (non-file path)
    setProductName('');
    setDescription('');
    setSelectedIconName(icons[0].name);
    setMinLoan('');
    setMaxLoan('');
    setDuration('30');
    setIsSalaryAdvance(false);
    setAdvancePercent('');
    setInstallments('');
    setSalaryFile(null);

    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add New Loan Product</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="product-name" className="text-right">Name</Label>
              <Input id="product-name" value={productName} onChange={(e) => setProductName(e.target.value)} className="col-span-3" required />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">Description</Label>
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Icon</Label>
                <div className="col-span-3 flex space-x-2">
                    {icons.map(({ name, component: Icon }) => (
                    <Button
                        key={name}
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => handleSelectIcon(name)}
                        className={cn('h-12 w-12', selectedIconName === name && 'ring-2 ring-primary')}
                    >
                        <Icon className="h-6 w-6" />
                    </Button>
                    ))}
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => fileInputRef.current?.click()}
                        className={cn(
                            'h-12 w-12',
                            selectedIconName.startsWith('data:image/') && 'ring-2 ring-primary'
                        )}
                    >
                       {selectedIconName.startsWith('data:image/') ? (
                          <img src={selectedIconName} alt="Custom Icon" className="h-6 w-6" />
                        ) : (
                          <Upload className="h-6 w-6" />
                        )}
                    </Button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/svg+xml,image/png,image/jpeg"
                        onChange={handleCustomIconUpload}
                    />
                </div>
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="min-loan" className="text-right">Min Loan</Label>
              {!isSalaryAdvance ? (
                <Input id="min-loan" type="number" value={minLoan} onChange={(e) => setMinLoan(e.target.value)} className="col-span-3" required />
              ) : (
                <div className="col-span-3 text-muted-foreground">Disabled for salary-advance</div>
              )}
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="max-loan" className="text-right">Max Loan</Label>
              {!isSalaryAdvance ? (
                <Input id="max-loan" type="number" value={maxLoan} onChange={(e) => setMaxLoan(e.target.value)} className="col-span-3" required />
              ) : (
                <div className="col-span-3 text-muted-foreground">Disabled for salary-advance</div>
              )}
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Salary Advance</Label>
              <div className="col-span-3">
                <label className="inline-flex items-center space-x-2">
                  <input type="checkbox" checked={isSalaryAdvance} onChange={(e) => setIsSalaryAdvance(e.target.checked)} />
                  <span>Enable salary advance for this product</span>
                </label>
              </div>
            </div>
            {isSalaryAdvance && (
              <>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="advance-percent" className="text-right">Advance Percent</Label>
                  <Input id="advance-percent" type="number" value={advancePercent} onChange={(e) => setAdvancePercent(e.target.value)} className="col-span-3" placeholder="e.g. 50" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="installments" className="text-right">Installments</Label>
                  <Input id="installments" type="number" value={installments} onChange={(e) => setInstallments(e.target.value)} className="col-span-3" placeholder="e.g. 12" required />
                </div>
                {installments && Number(installments) > 0 && (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Repayment Interval</Label>
                    <div className="col-span-3 text-sm text-muted-foreground">Every {Math.floor((Number(duration) || 0) / Number(installments)) || 0} days</div>
                  </div>
                )}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Upload Salary CSV</Label>
                  <div className="col-span-3">
                    <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => setSalaryFile(e.target.files ? e.target.files[0] : null)} />
                    <div className="text-sm text-muted-foreground">CSV columns: accountNumber,salary</div>
                  </div>
                </div>
              </>
            )}
             <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="duration" className="text-right">Duration (days)</Label>
              <Input id="duration" type="number" value={duration} onChange={(e) => setDuration(e.target.value)} className="col-span-3" required />
            </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit">Submit for Approval</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
