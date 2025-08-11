
'use client';

import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { PlusCircle, Trash2 } from 'lucide-react';
import { useScoringRules, type Rule } from '@/hooks/use-scoring-rules';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ScorePreview } from '@/components/loan/score-preview';

const RuleRow = ({ rule, onUpdate, onRemove }: { rule: Rule; onUpdate: (updatedRule: Rule) => void; onRemove: () => void; }) => {
    return (
        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
            <Input 
                placeholder="e.g., age"
                value={rule.field}
                onChange={(e) => onUpdate({ ...rule, field: e.target.value })}
                className="w-1/4"
            />
             <Input 
                placeholder="e.g., >"
                value={rule.condition}
                onChange={(e) => onUpdate({ ...rule, condition: e.target.value })}
                className="w-1/4"
            />
            <Input 
                placeholder="e.g., 30"
                value={rule.value}
                onChange={(e) => onUpdate({ ...rule, value: e.target.value })}
                 className="w-1/4"
            />
            <Input 
                type="number"
                placeholder="Score"
                value={rule.score}
                onChange={(e) => onUpdate({ ...rule, score: parseInt(e.target.value) || 0 })}
                 className="w-1/4"
            />
            <Button variant="ghost" size="icon" onClick={onRemove} className="text-destructive">
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
    );
};


export default function CreditScoreEnginePage() {
    const { parameters, addParameter, updateParameter, removeParameter, addRule, updateRule, removeRule } = useScoringRules();
    const [deletingParameterId, setDeletingParameterId] = useState<string | null>(null);

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Credit Scoring Engine</h2>
                    <p className="text-muted-foreground">
                        Define the parameters and rules used to calculate customer credit scores.
                    </p>
                </div>
                <Button onClick={addParameter}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Parameter
                </Button>
            </div>

            <div className="space-y-4">
                {parameters.map((param, pIndex) => (
                    <Card key={param.id}>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div className="flex items-center gap-4 w-full">
                                <Input 
                                    placeholder="Parameter Name"
                                    value={param.name}
                                    onChange={(e) => updateParameter(param.id, { ...param, name: e.target.value })}
                                    className="text-lg font-semibold w-1/3"
                                />
                                <div className="flex items-center gap-2">
                                     <Label>Weight:</Label>
                                     <Input 
                                        type="number"
                                        placeholder="%"
                                        value={param.weight}
                                        onChange={(e) => updateParameter(param.id, { ...param, weight: parseInt(e.target.value) || 0 })}
                                        className="w-20"
                                    />
                                </div>
                            </div>
                             <AlertDialog open={deletingParameterId === param.id} onOpenChange={(isOpen) => !isOpen && setDeletingParameterId(null)}>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="icon" onClick={() => setDeletingParameterId(param.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action cannot be undone. This will permanently delete the &quot;{param.name}&quot; parameter and all of its rules.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => removeParameter(param.id)}>Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </CardHeader>
                        <CardContent>
                            <Accordion type="single" collapsible>
                                <AccordionItem value="rules">
                                    <AccordionTrigger>Manage Rules</AccordionTrigger>
                                    <AccordionContent className="space-y-2">
                                        <div className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
                                            <Label className="w-1/4">Field</Label>
                                            <Label className="w-1/4">Condition</Label>
                                            <Label className="w-1/4">Value</Label>
                                            <Label className="w-1/4">Score</Label>
                                        </div>
                                        {param.rules.map((rule, rIndex) => (
                                           <RuleRow 
                                                key={rule.id}
                                                rule={rule}
                                                onUpdate={(updatedRule) => updateRule(param.id, rule.id, updatedRule)}
                                                onRemove={() => removeRule(param.id, rule.id)}
                                           />
                                        ))}
                                         <Button variant="outline" className="mt-2 w-full" onClick={() => addRule(param.id)}>
                                            <PlusCircle className="mr-2 h-4 w-4" /> Add Rule
                                        </Button>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </CardContent>
                    </Card>
                ))}
            </div>
             <ScorePreview parameters={parameters} />
        </div>
    );
}
